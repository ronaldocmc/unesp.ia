import { resolve4 } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { Buffer } from 'node:buffer'

export class ImportError extends Error {
  constructor(message, status = 422) { super(message); this.status = status }
}

export function publicURL(input, base) {
  if (typeof input !== 'string' || input.length > 2048) throw new ImportError('Informe um link HTTPS público válido.')
  let url
  try { url = new URL(input, base) } catch { throw new ImportError('Informe um link HTTPS público válido.') }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(host) ||
      host.includes(':') || !host.includes('.') || /(^|\.)(localhost|local|internal|lan|test|invalid|example)$/.test(host) ||
      host.endsWith('.') || !/^[a-z0-9.-]+$/.test(host)) {
    throw new ImportError('Use uma página pública HTTPS, sem senha, endereço IP ou porta personalizada.')
  }
  url.hash = ''
  return url
}

export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false
  const [a, b, c] = ip.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113))
}

const MAX_BYTES = 1024 * 1024
// Pin the validated address: a second DNS lookup must never reach an internal service.
function readPinnedPage(url, address, signal) {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', signal, agent: false,
      headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': 'ObservarIA-LinkPreview/1.0' },
      lookup: (_host, options, callback) => options?.all
        ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4),
    }, response => {
      const status = response.statusCode || 0
      const location = response.headers.location
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.destroy(); resolve({ location }); return
      }
      if (status < 200 || status >= 300) {
        response.destroy(); reject(new ImportError('A fonte não permitiu a leitura. Use o cadastro manual.')); return
      }
      if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(response.headers['content-type'] || '')) {
        response.destroy(); reject(new ImportError('Este link não é uma página HTML. Cadastre PDFs, vídeos e outros arquivos manualmente.')); return
      }
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.destroy(); reject(new ImportError('A fonte enviou um formato não suportado. Use o cadastro manual.')); return
      }
      let size = 0
      const chunks = []
      response.on('data', chunk => {
        size += chunk.length
        if (size > MAX_BYTES) { response.destroy(new ImportError('Página muito grande para importação. Use o cadastro manual.')); return }
        chunks.push(chunk)
      })
      response.on('end', () => {
        const bytes = Buffer.concat(chunks)
        const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(response.headers['content-type'] || '')?.[1] || 'utf-8'
        let html
        try { html = new TextDecoder(charset).decode(bytes) } catch { html = bytes.toString('utf8') }
        resolve({ html })
      })
      response.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

export async function fetchPage(input, dependencies = {}) {
  const lookup = dependencies.resolve || resolve4
  const read = dependencies.read || readPinnedPage
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new ImportError('A fonte demorou para responder. Tente novamente ou cadastre manualmente.')), { once: true }))
  try {
    let url = publicURL(input)
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await Promise.race([lookup(url.hostname), aborted])
      if (!addresses.length || addresses.some(address => !publicIPv4(address))) throw new ImportError('O endereço da fonte não é público.')
      const result = await Promise.race([read(url, addresses[0], controller.signal), aborted])
      if (!result.location) return { html: result.html, url: url.href }
      url = publicURL(result.location, url)
    }
    throw new ImportError('A fonte redirecionou muitas vezes. Use o link final ou o cadastro manual.')
  } catch (error) {
    if (error instanceof ImportError) throw error
    throw new ImportError('Não foi possível ler esta fonte. Tente outro link ou faça o cadastro manual.')
  } finally { clearTimeout(timer) }
}

const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
function decode(value) {
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || match
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })
}
function plain(value, max) { return decode(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) }
function attributes(tag) {
  const result = {}
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4]
  }
  return result
}

export function extractMetadata(html, inputURL) {
  const url = publicURL(inputURL)
  const metadata = {}
  const head = html.split(/<\/head\s*>/i)[0]
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attr = attributes(tag)
    const key = (attr.property || attr.name || attr.itemprop || '').toLowerCase()
    if (key && !metadata[key]) metadata[key] = attr.content || ''
  }
  const title = metadata['og:title'] || metadata['twitter:title'] || /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  const rawDate = metadata['article:published_time'] || metadata.datepublished || metadata.date || metadata.pubdate || ''
  const date = /^\d{4}-\d{2}-\d{2}/.exec(rawDate)?.[0] || ''
  const validDate = date && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : ''
  let image = ''
  try { if (metadata['og:image'] || metadata['twitter:image']) image = publicURL(decode(metadata['og:image'] || metadata['twitter:image']), url).href } catch { /* Optional preview only. */ }
  const draft = {
    colecao: 'Observatório', tipo: 'Notícia monitorada', categoria: 'Atualidades',
    titulo: plain(title, 300), resumo: plain(metadata['og:description'] || metadata.description || metadata['twitter:description'], 1200),
    fonte: plain(metadata['og:site_name'] || url.hostname.replace(/^www\./, ''), 200),
    data_publicacao: validDate, url: url.href, imagem_url: image,
    origem: 'Importação', status: 'rascunho', destaque: false, revisao_humana: false,
  }
  const warnings = ['Confira título, resumo, data, fonte e direitos de uso da imagem antes de publicar. O resumo foi extraído da página, não gerado por IA.']
  if (!draft.titulo || !draft.resumo || !draft.data_publicacao) warnings.push('A fonte não informou todos os campos. Complete os dados ausentes manualmente.')
  return { draft, warnings }
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
export function createHandler({ authorize, readPage = fetchPage }) {
  return async req => {
    const json = (data, status = 200) => Response.json(data, { status, headers: cors })
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
    try {
      const authorization = req.headers.get('Authorization') || ''
      if (!authorization.startsWith('Bearer ')) throw new ImportError('Entre no painel administrativo para continuar.', 401)
      await authorize(authorization)
      if (!req.headers.get('content-type')?.includes('application/json')) throw new ImportError('Envie um link em formato JSON.', 400)
      const reader = req.body?.getReader()
      if (!reader) throw new ImportError('Informe o link.', 400)
      const chunks = []; let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.length
          if (size > 4096) { await reader.cancel(); throw new ImportError('Solicitação muito grande.', 413) }
          chunks.push(value)
        }
      } finally { reader.releaseLock() }
      let body
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ImportError('Solicitação inválida.', 400) }
      const url = publicURL(body?.url)
      const page = await readPage(url.href)
      return json(extractMetadata(page.html, page.url))
    } catch (error) {
      return json({ error: error instanceof ImportError ? error.message : 'Não foi possível importar o link. Use o cadastro manual.' }, error instanceof ImportError ? error.status : 500)
    }
  }
}
