import { resolve4 } from 'node:dns/promises'
import { request } from 'node:https'
import { Buffer } from 'node:buffer'
// Reutiliza a validação SSRF do importador já existente no projeto.
import { publicURL, publicIPv4 } from '../observatorio-link/core.mjs'

function readFeed(url, address, signal) {
  return new Promise((resolve, reject) => {
    const req = request(url, { signal, agent: false, headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'Accept-Encoding': 'identity', 'User-Agent': 'ObservarIA-Radar/2.0 (+https://ia.fct.unesp.br/observatorio.html)',
    }, lookup: (_host, options, callback) => options?.all
      ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4),
    }, response => {
      const status = response.statusCode || 0
      if ([301,302,303,307,308].includes(status) && response.headers.location) {
        response.destroy(); resolve({ location: response.headers.location }); return
      }
      if (status < 200 || status >= 300) { response.destroy(); reject(new Error(`HTTP ${status}`)); return }
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.destroy(); reject(new Error('Compressão não suportada; use feed com resposta identity.')); return
      }
      const chunks = []; let size = 0
      response.on('data', chunk => {
        size += chunk.length
        if (size > 2000000) { response.destroy(new Error('Feed muito grande (máximo 2 MB).')); return }
        chunks.push(chunk)
      })
      response.on('end', () => {
        const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(response.headers['content-type'] || '')?.[1] || 'utf-8'
        const bytes = Buffer.concat(chunks)
        try { resolve({ xml: new TextDecoder(charset).decode(bytes) }) } catch { resolve({ xml: bytes.toString('utf8') }) }
      })
      response.on('error', reject)
    })
    req.on('error', reject); req.end()
  })
}

export async function downloadFeed(input, timeoutMs, { lookup = resolve4, read = readFeed } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Tempo limite ao acessar feed.')), { once: true }))
  try {
    let url = publicURL(input)
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await Promise.race([lookup(url.hostname), aborted])
      if (!addresses.length || addresses.some(address => !publicIPv4(address))) throw new Error('Endereço do feed não é público.')
      const result = await Promise.race([read(url, addresses[0], controller.signal), aborted])
      if (!result.location) return result.xml
      url = publicURL(result.location, url)
    }
    throw new Error('Muitos redirecionamentos no feed.')
  } finally { clearTimeout(timer) }
}
