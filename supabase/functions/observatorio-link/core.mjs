import { resolve4 } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { Buffer } from 'node:buffer'
import { selectPublicationDate } from '../../../assets/js/portal/publication-date.js'
import { readPinnedEdgePage } from './edge-transport.mjs'

export class ImportError extends Error {
  constructor(message, status = 422) { super(message); this.status = status }
}

export function unespArticleRoute(value) {
  let url
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:' || url.hostname !== 'www2.unesp.br' || url.port || url.username || url.password
    || !/^\/portal\/?$/.test(url.pathname) || url.search) return null
  const match = /^#!\/noticias\/v\/id::([1-9]\d{0,9})(?:\/([a-z0-9-]{1,400}))?\/?$/i.exec(url.hash)
  return match ? { id: match[1], article: `id::${match[1]}${match[2] ? '/' + match[2] : ''}`, url: url.href } : null
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
  if (!unespArticleRoute(url.href)) url.hash = ''
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

// Restrição apenas da consulta XML interna do adaptador Unesp, não de sites HTML.
export function unespReadEndpoint(input) {
  let url
  try { url = publicURL(String(input)) } catch { return false }
  if (url.origin !== 'https://www2.unesp.br' || url.hash) return false
  const keys = [...url.searchParams.keys()]
  if (url.pathname === '/sharer.php') return keys.length === 1 && keys[0] === 'post' && /^[1-9]\d{0,9}$/.test(url.searchParams.get('post'))
  const args = url.searchParams.getAll('xajaxargs[]')
  return url.pathname === '/portal' && keys.length === 6 && keys.every(key => ['xajax','xajaxargs[]'].includes(key))
    && url.searchParams.getAll('xajax').length === 1 && url.searchParams.get('xajax') === 'exibeCorpo'
    && args.length === 5 && /^[1-9]\d{0,9}$/.test(args[0]) && args[1] === '' && args[2] === '' && args[4] === ''
    && /^id::[1-9]\d{0,9}(?:\/[a-z0-9-]{1,400})?$/i.test(args[3])
}


// Pin the validated address: a second DNS lookup must never reach an internal service.
function readPinnedPage(url, address, signal, { allowXML = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', signal, agent: false,
      headers: { Accept: allowXML ? 'text/xml,application/xml' : 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': 'ObservarIA-LinkPreview/1.0' },
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
      if (!(allowXML ? /^(text\/xml|application\/xml)\b/i : /^(text\/html|application\/xhtml\+xml)\b/i).test(response.headers['content-type'] || '')) {
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
  const lookup = dependencies.resolve || (globalThis.Deno?.resolveDns ? host => globalThis.Deno.resolveDns(host, 'A') : resolve4)
  const edgeRuntime = dependencies.edgeRuntime ?? !!globalThis.Deno
  const read = dependencies.read || ((url, address, signal, options) => edgeRuntime
    ? readPinnedEdgePage(url, address, signal, { ...options, network: dependencies.edgeNetwork || globalThis.Deno })
    : readPinnedPage(url, address, signal, options))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new ImportError('A fonte demorou para responder. Tente novamente ou cadastre manualmente.')), { once: true }))
  try {
    let url = publicURL(input)
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await Promise.race([lookup(url.hostname), aborted])
      if (!addresses.length || addresses.some(address => !publicIPv4(address))) throw new ImportError('O endereço da fonte não é público.')
      const result = await Promise.race([read(url, addresses[0], controller.signal, { allowXML: dependencies.allowXML === true && unespReadEndpoint(url.href) }), aborted])
      if (!result.location) return { html: result.html, url: url.href }
      url = publicURL(result.location, url)
    }
    throw new ImportError('A fonte redirecionou muitas vezes. Use o link final ou o cadastro manual.')
  } catch (error) {
    if (error instanceof ImportError) throw error
    throw new ImportError('Não foi possível ler esta fonte. Tente outro link ou faça o cadastro manual.')
  } finally { clearTimeout(timer); controller.abort() }
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
  const publicationDate = selectPublicationDate(html, url.href, metadata)
  let image = ''
  try { if (metadata['og:image'] || metadata['twitter:image']) image = publicURL(decode(metadata['og:image'] || metadata['twitter:image']), url).href } catch { /* Optional preview only. */ }
  const draft = {
    colecao: 'Observatório', tipo: 'Notícia monitorada', categoria: 'Atualidades',
    titulo: plain(title, 300), resumo: plain(metadata['og:description'] || metadata.description || metadata['twitter:description'], 1200),
    fonte: plain(metadata['og:site_name'] || url.hostname.replace(/^www\./, ''), 200),
    data_publicacao: publicationDate.date, url: url.href, imagem_url: image,
    origem: 'Importação', status: 'rascunho', destaque: false, revisao_humana: false,
  }
  const warnings = ['Confira título, resumo, data, fonte e direitos de uso da imagem antes de publicar. O resumo foi extraído da página, não gerado por IA.']
  if (publicationDate.source === 'url') warnings.push('Data sugerida a partir do endereço da matéria. Confira a data de publicação na fonte antes de salvar.')
  if (publicationDate.conflict) warnings.push('A fonte apresenta datas diferentes nos metadados. Foi usada a data de publicação dos dados estruturados; confira na matéria.')
  if (!draft.titulo || !draft.resumo || !draft.data_publicacao) warnings.push('A fonte não informou todos os campos. Complete os dados ausentes manualmente.')
  return { draft, warnings, date_source: publicationDate.source }
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
export function createHandler({ authorize, readPage = fetchPage }) {
  return async req => {
    const json = (data, status = 200) => Response.json({ ...data, versao_importador: '20261021-geral-edge' }, { status, headers: cors })
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
      if (unespArticleRoute(url.href)) return json(await importUnespArticle(url.href, readPage))
      const page = await readPage(url.href)
      return json(extractMetadata(page.html, page.url))
    } catch (error) {
      return json({ error: error instanceof ImportError ? error.message : 'Não foi possível importar o link. Use o cadastro manual.' }, error instanceof ImportError ? error.status : 500)
    }
  }
}

// Adaptador restrito ao protocolo público do Portal Unesp. Nunca executa comandos xajax.
export async function importUnespArticle(input, readPage = fetchPage) {
  const route = unespArticleRoute(input)
  if (!route) throw new ImportError('Endereço de notícia do Portal Unesp inválido.')
  const sharing = await readPage(`https://www2.unesp.br/sharer.php?post=${route.id}`)
  if (new URL(sharing.url).origin !== 'https://www2.unesp.br') throw new ImportError('A fonte redirecionou para outro domínio.')
  const meta = {}
  for (const [tag] of sharing.html.split(/<\/head\s*>/i)[0].matchAll(/<meta\b[^>]*>/gi)) {
    const attr = attributes(tag)
    meta[(attr.property || attr.name || '').toLowerCase()] = decode(attr.content || '')
  }
  if (unespArticleRoute(meta['og:url'])?.id !== route.id) throw new ImportError('A fonte não confirmou a notícia solicitada. Use o cadastro manual.')
  const result = extractMetadata(sharing.html, route.url)
  if (!result.draft.titulo) throw new ImportError('A fonte não informou o título da notícia.')
  result.draft.fonte = 'Portal Unesp'
  result.draft.data_publicacao = ''; result.date_source = null
  // O menu do CMS vem do caminho oficial da imagem da própria notícia, não do usuário.
  let menu
  try {
    const image = publicURL(meta['og:image'])
    const match = /^\/Home\/noticias([1-9]\d{0,9})\/\d{4}\/\d{2}\/([1-9]\d{0,9})\//.exec(image.pathname)
    if (image.origin === 'https://www2.unesp.br' && match?.[2] === route.id) menu = match[1]
  } catch { /* Sem caminho conhecido não inventa uma rota ou uma data. */ }
  if (menu) {
    try {
      const endpoint = new URL('https://www2.unesp.br/portal')
      endpoint.searchParams.set('xajax', 'exibeCorpo')
      for (const arg of [menu, '', '', route.article, '']) endpoint.searchParams.append('xajaxargs[]', arg)
      const response = await readPage(endpoint.href, { allowXML: true })
      if (new URL(response.url).origin !== endpoint.origin || response.html.length > MAX_BYTES) throw new ImportError('Resposta inválida.')
      // Lê só o HTML atribuído a idCorpo; scripts e demais comandos são ignorados.
      const command = [...response.html.matchAll(/<cmd\b([^>]*)>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/cmd>/gi)]
        .find(match => { const a = attributes(match[1]); return a.n === 'as' && a.t === 'idCorpo' && a.p === 'innerHTML' })
      const html = command?.[2] || ''
      const opening = new RegExp(`<div\\b[^>]*\\bid=["']pu-wrapper-post-full-view-${route.id}["'][^>]*>`, 'i').exec(html)
      if (!opening) throw new ImportError('Corpo da notícia não confirmado.')
      let depth = 1, end = -1
      const rest = html.slice(opening.index + opening[0].length)
      for (const token of rest.matchAll(/<div\b[^>]*>|<\/div\s*>/gi)) {
        depth += /^<\//.test(token[0]) ? -1 : 1
        if (!depth) { end = token.index; break }
      }
      if (end < 0) throw new ImportError('Corpo da notícia incompleto.')
      const article = rest.slice(0, end)
      const heading = /<h2\b[^>]*class=["'][^"']*\bpu-titulo-post\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i.exec(article)?.[1]
      if (plain(heading, 300) !== result.draft.titulo) throw new ImportError('Título divergente no corpo da notícia.')
      const dates = [...article.matchAll(/<div\b[^>]*class=["']col nowrap["'][^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}\s*<\/div>/gi)]
      if (dates.length === 1) {
        const [, day, month, year] = dates[0]
        const metadata = { 'article:published_time': `${year}-${month}-${day}` }
        const publication = selectPublicationDate('', route.url, metadata)
        result.draft.data_publicacao = publication.date; result.date_source = publication.source
      }
    } catch { result.warnings.push('Não foi possível confirmar a data no corpo desta notícia. Confira na fonte e preencha manualmente.') }
  }
  if (!result.draft.data_publicacao && !result.warnings.some(w => w.includes('corpo desta notícia'))) {
    result.warnings.push('A data desta notícia não pôde ser confirmada. Confira na fonte e preencha manualmente.')
  }
  if (result.draft.titulo && result.draft.resumo && result.draft.data_publicacao) {
    result.warnings = result.warnings.filter(w => !w.startsWith('A fonte não informou todos os campos.'))
  }
  return result
}
