import { resolve4 } from 'node:dns/promises'
// Reutiliza validação de URL e DNS do importador; fetch não fixa o IP na conexão.
import { publicURL, publicIPv4 } from '../observatorio-link/core.mjs'

const FEED_MAX_BYTES = 2000000

async function readFeedResponse(response, signal) {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > FEED_MAX_BYTES) {
    response.body?.cancel().catch(() => {})
    throw new Error('Feed muito grande (máximo 2 MB).')
  }
  const reader = response.body?.getReader()
  if (!reader) return ''
  const abort = () => { reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  const chunks = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > FEED_MAX_BYTES) throw new Error('Feed muito grande (máximo 2 MB).')
      chunks.push(value)
    }
  } finally {
    signal.removeEventListener('abort', abort)
    try { await reader.cancel() } catch { /* Pode já estar encerrado/abortado. */ }
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(response.headers.get('content-type') || '')?.[1] || 'utf-8'
  try { return new TextDecoder(charset).decode(bytes) } catch { return new TextDecoder().decode(bytes) }
}

export async function downloadFeed(input, timeoutMs, {
  lookup = globalThis.Deno?.resolveDns ? host => globalThis.Deno.resolveDns(host, 'A') : resolve4,
  fetchImpl = fetch,
} = {}) {
  const controller = new AbortController()
  const timeout = new Error('Tempo limite ao acessar feed.')
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let abortListener
  const aborted = new Promise((_, reject) => {
    abortListener = () => reject(timeout)
    controller.signal.addEventListener('abort', abortListener, { once: true })
  })
  try {
    let url = publicURL(input)
    for (let redirects = 0; redirects <= 3; redirects++) {
      // Defesa prévia IPv4; o fetch ainda pode fazer sua própria resolução DNS.
      const addresses = await Promise.race([lookup(url.hostname), aborted])
      if (!addresses.length || addresses.some(address => !publicIPv4(address))) throw new Error('Endereço do feed não é público.')
      const response = await Promise.race([fetchImpl(url.href, {
        signal: controller.signal, redirect: 'manual',
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          'User-Agent': 'ObservarIA-Radar/2.2 (+https://ia.fct.unesp.br/observatorio.html)',
        },
      }), aborted])
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location')
        response.body?.cancel().catch(() => {})
        if (!location) throw new Error('Redirecionamento do feed sem destino.')
        if (redirects === 3) throw new Error('Muitos redirecionamentos no feed.')
        url = publicURL(location, url)
        continue
      }
      if (!response.ok) {
        response.body?.cancel().catch(() => {})
        throw new Error(`HTTP ${response.status}`)
      }
      return await Promise.race([readFeedResponse(response, controller.signal), aborted])
    }
    throw new Error('Muitos redirecionamentos no feed.')
  } catch (error) {
    if (controller.signal.aborted) throw timeout
    throw error
  } finally {
    clearTimeout(timer)
    controller.signal.removeEventListener('abort', abortListener)
    controller.abort()
  }
}
