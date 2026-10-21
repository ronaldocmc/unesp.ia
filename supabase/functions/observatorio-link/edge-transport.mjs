import { ImportError, publicURL, publicIPv4 } from './core.mjs'

const EDGE_MAX_BODY = 1024 * 1024
const EDGE_MAX_HEADERS = 32768
const EDGE_MAX_WIRE = EDGE_MAX_BODY + 131072
const edgeLatin = new TextDecoder('iso-8859-1')
const edgeFind = (bytes, sequence, start = 0) => {
  outer: for (let i = start; i <= bytes.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) if (bytes[i + j] !== sequence[j]) continue outer
    return i
  }
  return -1
}
const edgeFailure = message => new ImportError(message)

function edgeHeaders(bytes, partial = false) {
  let start = 0
  for (let interim = 0; interim < 5; interim++) {
    const end = edgeFind(bytes, [13,10,13,10], start)
    if (end < 0) {
      if (bytes.length - start > EDGE_MAX_HEADERS) throw edgeFailure('Cabeçalhos da fonte muito grandes.')
      if (partial) return null
      throw edgeFailure('Resposta incompleta da fonte.')
    }
    if (end + 4 > EDGE_MAX_HEADERS) throw edgeFailure('Cabeçalhos da fonte muito grandes.')
    const [line, ...fields] = edgeLatin.decode(bytes.subarray(start, end)).split('\r\n')
    const status = /^HTTP\/1\.[01] ([1-5]\d{2})(?: .*)?$/.exec(line)
    if (!status) throw edgeFailure('Resposta HTTP inválida da fonte.')
    const headers = Object.create(null)
    for (const field of fields) {
      const match = /^([!#$%&'*+.^_`|~0-9a-z-]+):[\t ]*([^\r\n]*)$/i.exec(field)
      if (!match) throw edgeFailure('Cabeçalho HTTP inválido da fonte.')
      const key = match[1].toLowerCase(), value = match[2].trim()
      if (headers[key] != null && ['content-length','transfer-encoding','location','content-type'].includes(key)) throw edgeFailure('Cabeçalhos ambíguos da fonte.')
      headers[key] = value
    }
    start = end + 4
    const code = Number(status[1])
    if ([100,102,103].includes(code)) continue
    if (code < 200 || code > 399) throw edgeFailure(`A fonte não permitiu a leitura (HTTP ${code}). Tente mais tarde ou use o cadastro manual.`)
    if ([301,302,303,307,308].includes(code)) {
      if (!headers.location) throw edgeFailure('Redirecionamento da fonte sem destino.')
      return { status: code, headers, bodyStart: start, location: headers.location }
    }
    if (code >= 300) throw edgeFailure(`A fonte não permitiu a leitura (HTTP ${code}).`)
    if (headers['transfer-encoding'] && headers['content-length']) throw edgeFailure('Enquadramento HTTP ambíguo da fonte.')
    if (headers['transfer-encoding'] && headers['transfer-encoding'].toLowerCase() !== 'chunked') throw edgeFailure('Codificação de transferência não suportada.')
    if (headers['content-length'] != null && (!/^\d+$/.test(headers['content-length']) || Number(headers['content-length']) > EDGE_MAX_BODY)) throw edgeFailure('Página muito grande ou tamanho inválido para importação.')
    if (headers['content-encoding'] && headers['content-encoding'].toLowerCase() !== 'identity') throw edgeFailure('A fonte enviou um formato não suportado. Use o cadastro manual.')
    return { status: code, headers, bodyStart: start }
  }
  throw edgeFailure('Muitas respostas HTTP intermediárias.')
}

function edgeChunks(bytes, partial = false) {
  const chunks = []; let offset = 0, size = 0
  const incomplete = () => { if (partial) return null; throw edgeFailure('Corpo HTTP incompleto da fonte.') }
  while (offset < bytes.length) {
    const end = edgeFind(bytes, [13,10], offset)
    if (end < 0) { if (bytes.length - offset > 4096) throw edgeFailure('Bloco HTTP inválido.'); return incomplete() }
    if (end - offset > 4096) throw edgeFailure('Bloco HTTP inválido.')
    const line = edgeLatin.decode(bytes.subarray(offset, end))
    if (!/^[0-9a-f]{1,8}(?:;[^\r\n]*)?$/i.test(line)) throw edgeFailure('Tamanho de bloco HTTP inválido.')
    const length = parseInt(line.split(';')[0], 16)
    offset = end + 2
    if (!length) {
      if (bytes.length < offset + 2) return incomplete()
      let finish
      if (bytes[offset] === 13 && bytes[offset + 1] === 10) finish = offset + 2
      else {
        const trailerEnd = edgeFind(bytes, [13,10,13,10], offset)
        if (trailerEnd < 0) { if (bytes.length - offset > EDGE_MAX_HEADERS) throw edgeFailure('Rodapé HTTP muito grande.'); return incomplete() }
        if (trailerEnd - offset > EDGE_MAX_HEADERS) throw edgeFailure('Rodapé HTTP muito grande.')
        finish = trailerEnd + 4
      }
      if (finish !== bytes.length) throw edgeFailure('Dados excedentes no corpo HTTP.')
      const body = new Uint8Array(size); let index = 0
      for (const chunk of chunks) { body.set(chunk, index); index += chunk.length }
      return body
    }
    size += length
    if (size > EDGE_MAX_BODY) throw edgeFailure('Página muito grande para importação.')
    if (bytes.length < offset + length + 2) return incomplete()
    if (bytes[offset + length] !== 13 || bytes[offset + length + 1] !== 10) throw edgeFailure('Bloco HTTP inválido.')
    chunks.push(bytes.subarray(offset, offset + length)); offset += length + 2
  }
  return incomplete()
}

export function parseEdgeHTTPResponse(bytes, { allowXML = false } = {}) {
  if (bytes.length > EDGE_MAX_WIRE) throw edgeFailure('Página muito grande para importação.')
  const head = edgeHeaders(bytes)
  if (head.location) return { location: head.location }
  const type = head.headers['content-type'] || ''
  if (!(allowXML ? /^(text\/xml|application\/xml)\b/i : /^(text\/html|application\/xhtml\+xml)\b/i).test(type)) throw edgeFailure('Este link não retornou uma página HTML compatível. Use o cadastro manual.')
  let body = bytes.subarray(head.bodyStart)
  if (head.headers['transfer-encoding']) body = edgeChunks(body)
  else if (head.headers['content-length'] != null && body.length !== Number(head.headers['content-length'])) throw edgeFailure('Corpo HTTP incompleto ou excedente na fonte.')
  if (body.length > EDGE_MAX_BODY) throw edgeFailure('Página muito grande para importação.')
  const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(type)?.[1] || 'utf-8'
  try { return { html: new TextDecoder(charset).decode(body) } }
  catch { return { html: new TextDecoder().decode(body) } }
}

// Conecta ao IP validado e verifica certificado/SNI pelo hostname original.
// Não usa lookup de ClientRequest, segunda resolução DNS, proxy ou TLS inseguro.
export async function readPinnedEdgePage(input, address, signal, { allowXML = false, network = globalThis.Deno } = {}) {
  const url = publicURL(input.href)
  if (!publicIPv4(address)) throw edgeFailure('O endereço da fonte não é público.')
  if (!network?.connect || !network?.startTls) throw edgeFailure('Transporte seguro indisponível neste runtime. Use o cadastro manual.')
  let connection
  const close = () => { try { connection?.close() } catch { /* Conexão já fechada. */ } }
  const check = () => { if (signal.aborted) { close(); throw edgeFailure('A fonte demorou para responder. Tente novamente.') } }
  const adopt = async promise => { connection = await promise; check(); return connection }
  signal.addEventListener('abort', close, { once: true })
  try {
    check()
    await adopt(network.connect({ hostname: address, port: 443, transport: 'tcp' }))
    await adopt(network.startTls(connection, { hostname: url.hostname, alpnProtocols: ['http/1.1'] }))
    await connection.handshake(); check()
    const request = new TextEncoder().encode(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nAccept: ${allowXML ? 'text/xml,application/xml' : 'text/html,application/xhtml+xml'}\r\nAccept-Encoding: identity\r\nUser-Agent: ObservarIA-LinkPreview/1.2\r\nConnection: close\r\n\r\n`)
    for (let sent = 0; sent < request.length;) {
      const written = await connection.write(request.subarray(sent)); check()
      if (!written) throw edgeFailure('Não foi possível enviar a consulta à fonte.')
      sent += written
    }
    let bytes = new Uint8Array(0), head = null
    while (true) {
      const buffer = new Uint8Array(16384)
      const count = await connection.read(buffer); check()
      if (count == null) break
      if (!count) throw edgeFailure('Leitura incompleta da fonte.')
      if (bytes.length + count > EDGE_MAX_WIRE) throw edgeFailure('Página muito grande para importação.')
      const next = new Uint8Array(bytes.length + count); next.set(bytes); next.set(buffer.subarray(0, count), bytes.length); bytes = next
      head ||= edgeHeaders(bytes, true)
      if (head?.location) return { location: head.location }
      if (head?.headers['content-length'] != null && bytes.length - head.bodyStart >= Number(head.headers['content-length'])) break
      if (head?.headers['transfer-encoding'] && edgeChunks(bytes.subarray(head.bodyStart), true)) break
    }
    return parseEdgeHTTPResponse(bytes, { allowXML })
  } finally { signal.removeEventListener('abort', close); close() }
}
