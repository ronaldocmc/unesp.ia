import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchPage, extractMetadata } from '../supabase/functions/observatorio-link/core.mjs'
import { readPinnedEdgePage, parseEdgeHTTPResponse } from '../supabase/functions/observatorio-link/edge-transport.mjs'
import { edgeFixtureResponse, mockEdgeNetwork } from './helpers/edge-connection.mjs'

const bytes = value => new TextEncoder().encode(value)
const address = '93.184.215.14'
test('Edge aceita qualquer domínio HTTPS público sem lista de veículos, fixando IP e nome TLS', async () => {
  for (const host of ['www.cnnbrasil.com.br','www.oabsp.org.br','pesquisa.publica.org']) {
    const mock = mockEdgeNetwork(async () => edgeFixtureResponse('<title>Pesquisa em IA</title><meta property="article:published_time" content="2026-10-13">'), { packetSize: 17 })
    const page = await fetchPage(`https://${host}/noticia?q=ia`, { edgeRuntime: true, resolve: async () => [address], edgeNetwork: mock.network })
    assert.equal(extractMetadata(page.html, page.url).draft.data_publicacao, '2026-10-13')
    assert.deepEqual(mock.calls, [{ operation: 'connect', hostname: address, port: 443, transport: 'tcp' },
      { operation: 'tls', hostname: host, alpnProtocols: ['http/1.1'] }])
    assert.match(mock.requests[0], /^GET \/noticia\?q=ia HTTP\/1.1\r\n/)
    assert.ok(mock.requests[0].includes(`Host: ${host}\r\n`)); assert.ok(mock.closes > 0)
    assert.doesNotMatch(mock.requests[0], /Authorization:|Cookie:/i)
  }
})

test('Edge revalida cada redirect: público continua, DNS privado e HTTP são bloqueados antes da conexão', async () => {
  const mock = mockEdgeNetwork(async request => request.includes('Host: site.org')
    ? 'HTTP/1.1 302 Found\r\nLocation: https://final.org/artigo\r\n\r\n' : edgeFixtureResponse('<title>Final</title>'))
  const result = await fetchPage('https://site.org/inicio', { edgeRuntime: true, resolve: async () => [address], edgeNetwork: mock.network })
  assert.equal(result.url, 'https://final.org/artigo'); assert.equal(mock.calls.filter(x => x.operation === 'connect').length, 2)
  for (const [location, dns] of [['https://private.org', ['127.0.0.1']], ['http://final.org', [address]], ['https://private.org', [address,'10.0.0.1']]]) {
    const blocked = mockEdgeNetwork(async () => `HTTP/1.1 302 Found\r\nLocation: ${location}\r\n\r\n`)
    await assert.rejects(fetchPage('https://site.org/', { edgeRuntime: true, resolve: async host => host === 'site.org' ? [address] : dns, edgeNetwork: blocked.network }), /público|HTTPS/)
    assert.equal(blocked.calls.filter(x => x.operation === 'connect').length, 1)
  }
  const loop = mockEdgeNetwork(async () => 'HTTP/1.1 302 Found\r\nLocation: /loop\r\n\r\n')
  await assert.rejects(fetchPage('https://site.org/', { edgeRuntime: true, resolve: async () => [address], edgeNetwork: loop.network }), /muitas vezes/)
  assert.equal(loop.calls.filter(x => x.operation === 'connect').length, 4)
})

test('leitura Edge rejeita TLS inválido e fecha conexão, sem fallback inseguro', async () => {
  const mock = mockEdgeNetwork(async () => { throw new Error('Não ler corpo') }, { handshakeError: new Error('certificate invalid') })
  await assert.rejects(readPinnedEdgePage(new URL('https://site.org/a'), address, new AbortController().signal, { network: mock.network }), /certificate/)
  assert.equal(mock.requests.length, 0); assert.ok(mock.closes > 0)
  await assert.rejects(readPinnedEdgePage(new URL('https://site.org'), '127.0.0.1', new AbortController().signal, { network: mock.network }), /não é público/)
})

test('abort durante conexão fecha também uma conexão resolvida tardiamente', async () => {
  let release, closed = 0
  const controller = new AbortController()
  const pending = readPinnedEdgePage(new URL('https://site.org/a'), address, controller.signal, {
    network: { connect: () => new Promise(resolve => { release = resolve }), startTls() { throw new Error('Não negociar TLS') } },
  })
  controller.abort(); release({ close() { closed++ } })
  await assert.rejects(pending, /demorou/); assert.ok(closed > 0)
})

test('parser HTTP aceita tamanho conhecido, EOF, chunked e resposta intermediária sem misturar bytes', () => {
  assert.equal(parseEdgeHTTPResponse(edgeFixtureResponse('Ciência & IA')).html, 'Ciência & IA')
  assert.equal(parseEdgeHTTPResponse(bytes('HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\nTexto')).html, 'Texto')
  assert.equal(parseEdgeHTTPResponse(bytes('HTTP/1.1 103 Early Hints\r\nLink: </style>\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\nTransfer-Encoding: chunked\r\n\r\n3;ext=yes\r\nabc\r\n2\r\nde\r\n0\r\nX-Final: done\r\n\r\n')).html, 'abcde')
  assert.equal(parseEdgeHTTPResponse(edgeFixtureResponse('<xjx/>', { 'Content-Type': 'text/xml' }), { allowXML: true }).html, '<xjx/>')
})

test('parser rejeita enquadramento ambíguo, corpo truncado, MIME inválido e excesso de tamanho', () => {
  const header = 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n'
  for (const bad of [
    header + 'Content-Length: 3\r\nContent-Length: 3\r\n\r\nabc',
    header + 'Content-Length: 3\r\nTransfer-Encoding: chunked\r\n\r\nabc',
    header + 'Content-Length: 4\r\n\r\nabc', header + 'Content-Length: 2\r\n\r\nabc',
    header + 'Transfer-Encoding: chunked\r\n\r\n3\r\nabc',
    header + 'Transfer-Encoding: chunked\r\n\r\nZ\r\nabc\r\n0\r\n\r\n',
    header + 'Transfer-Encoding: chunked\r\n\r\n0\r\n\r\nextra',
    header + 'Transfer-Encoding: gzip\r\n\r\nabc', header + 'Content-Encoding: gzip\r\n\r\nabc',
    header + 'Content-Length: 1048577\r\n\r\n', header + 'X-Large: ' + 'x'.repeat(32768) + '\r\n\r\n',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{}',
  ]) assert.throws(() => parseEdgeHTTPResponse(bytes(bad)))
  assert.throws(() => parseEdgeHTTPResponse(edgeFixtureResponse('x'.repeat(1048577))), /grande/)
  assert.throws(() => parseEdgeHTTPResponse(bytes('HTTP/1.1 429 Limited\r\n\r\n')), /HTTP 429/)
})
