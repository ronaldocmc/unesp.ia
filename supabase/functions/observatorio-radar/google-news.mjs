import { decode } from './core.mjs'
import { downloadRadarPage, readFeedResponse } from './feed-network.mjs'
import { publicURL } from '../observatorio-link/core.mjs'

export function isGoogleNewsLink(value) {
  try { return new URL(value).hostname === 'news.google.com' } catch { return false }
}

function publisherURL(value) {
  try {
    const url = publicURL(value)
    if (/(^|\.)google\.[a-z.]+$/.test(url.hostname) || url.pathname === '/') return null
    return url.href
  } catch { return null }
}

// Older Google News IDs contain a protobuf length-delimited publisher URL.
// Read its length rather than matching arbitrary URL substrings in opaque IDs.
export function decodeGoogleNewsID(link) {
  try {
    if (!isGoogleNewsLink(link)) return null
    const id = new URL(link).pathname.match(/\/(?:articles|read)\/([A-Za-z0-9_-]{1,4096})$/)?.[1]
    if (!id) return null
    const binary = atob(id.replace(/-/g, '+').replace(/_/g, '/'))
    let offset = 0
    const integer = () => {
      let value = 0, shift = 0
      for (let n = 0; n < 5 && offset < binary.length; n++) {
        const byte = binary.charCodeAt(offset++)
        value += (byte & 127) * 2 ** shift
        if (!(byte & 128)) return value
        shift += 7
      }
      throw new Error('Invalid protobuf')
    }
    while (offset < binary.length) {
      const key = integer(), wire = key & 7
      if (wire === 0) integer()
      else if (wire === 2) {
        const length = integer(), end = offset + length
        if (end > binary.length) return null
        const value = binary.slice(offset, end); offset = end
        if ((key >>> 3) === 4) return publisherURL(value)
      } else return null
    }
  } catch { /* Not a legacy ID. Try the public article page instead. */ }
  return null
}

export async function resolveGoogleNewsLink(link, { readPage = downloadRadarPage, fetchImpl = fetch, timeoutMs = 5000, onDiagnostic = () => {} } = {}) {
  let stage = 'pagina'
  const fail = reason => { onDiagnostic(reason); return null }
  if (!isGoogleNewsLink(link)) return link
  const legacy = decodeGoogleNewsID(link)
  if (legacy) return legacy
  const id = new URL(link).pathname.match(/\/(?:articles|read)\/([A-Za-z0-9_-]{1,4096})$/)?.[1]
  if (!id) return fail('identificador inválido')
  try {
    const page = await readPage(`https://news.google.com/articles/${id}`, timeoutMs)
    if (!isGoogleNewsLink(page.url)) return publisherURL(page.url) || fail('redirecionamento sem endereço original válido')
    // This is an undocumented Google endpoint: fail safely if its format changes.
    // No cookies, credentials, consent bypass, or retries on blocking responses.
    const signature = decode(page.html.match(/data-n-a-sg=["']([^"']{1,1024})["']/)?.[1] || '')
    const timestamp = page.html.match(/data-n-a-ts=["'](\d{1,12})["']/)?.[1]
    if (!signature || !timestamp) return fail('página do Google sem parâmetros de conversão (possível consentimento ou bloqueio)')
    const context = [['X','X',['X','X'],null,null,1,1,'US:en',null,1,null,null,null,null,null,0,1], 'X','X',1,[1,1,1],1,1,null,0,0,null,0]
    const request = JSON.stringify(['garturlreq', context, id, Number(timestamp), signature])
    stage = 'conversao'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', request, null, 'generic']]]) }).toString(),
      })
      if (!response.ok) { await response.body?.cancel(); return fail(`conversão Google HTTP ${response.status}`) }
      const text = await readFeedResponse(response, controller.signal)
      for (const line of text.split('\n')) {
        if (!line.startsWith('[[')) continue
        try {
          const rows = JSON.parse(line)
          for (const row of rows) {
            if (row[0] !== 'wrb.fr' || row[1] !== 'Fbv4je' || typeof row[2] !== 'string') continue
            const result = JSON.parse(row[2])
            if (result[0] === 'garturlres') return publisherURL(result[1]) || fail('resposta sem endereço original válido')
          }
        } catch { /* Ignore unrelated or malformed frames. */ }
      }
    } finally { clearTimeout(timer); controller.abort() }
  } catch (error) {
    // Only expose controlled diagnostics, never raw response bodies or stack traces.
    const message = String(error?.message || '')
    const status = /^HTTP (\d{3})$/.exec(message)?.[1]
    return fail(status ? `${stage}: HTTP ${status}` : /abort|tempo limite|timed? ?out/i.test(message) || error?.name === 'AbortError'
      ? `${stage}: tempo limite` : /grande|2 MB/i.test(message) ? `${stage}: página excede 2 MB` : `${stage}: falha de rede ou validação`)
  }
  return fail('Google retornou um formato de conversão não reconhecido')
}

export async function resolveGoogleNewsItems(items, { resolve = resolveGoogleNewsLink, ...dependencies } = {}) {
  const cache = new Map()
  const deadline = Date.now() + 20000
  // Bound extra work per execution; remaining candidates stay explicitly unresolved.
  for (const item of items) {
    if (!isGoogleNewsLink(item.link)) continue
    const original = item.link
    let reason = 'limite de 10 conversões ou tempo total de 20 segundos atingido'
    const legacy = decodeGoogleNewsID(original)
    if (legacy) { item.link = legacy; item.google_news_url = original; continue }
    if (!cache.has(original) && cache.size < 10 && Date.now() < deadline) {
      reason = 'conversão não concluída'
      try {
        const link = await resolve(original, { ...dependencies, timeoutMs: Math.max(1, Math.min(3000, deadline - Date.now())), onDiagnostic: value => { reason = value } })
        cache.set(original, { link, reason })
      } catch { cache.set(original, { link: null, reason: 'falha no resolvedor' }) }
    }
    const resolved = cache.get(original)
    if (resolved?.link) { item.link = resolved.link; item.google_news_url = original }
    else item.observacao_colaborador = `Link do Google Notícias — endereço original não identificado. Diagnóstico: ${resolved?.reason || reason}. Confira a matéria antes de publicar.`
  }
  return items
}
