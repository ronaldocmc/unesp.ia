import test from 'node:test'
import assert from 'node:assert/strict'
import { downloadFeed } from '../supabase/functions/observatorio-radar/feed-network.mjs'

const url = 'https://news.example.org/feed'
const lookup = async () => ['93.184.216.34']

test('fetch lê corpo fragmentado com sinal e redirecionamento manual', async () => {
  let request
  const xml = await downloadFeed(url, 1000, { lookup, fetchImpl: async (target, options) => {
    request = { target, options }
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('<rss>'))
      controller.enqueue(new TextEncoder().encode('</rss>')); controller.close()
    } }))
  } })
  assert.equal(xml, '<rss></rss>'); assert.equal(request.target, url)
  assert.equal(request.options.redirect, 'manual'); assert.ok(request.options.signal)
})
test('fetch bloqueia URL interna e DNS IPv4 privado/misto antes da chamada', async () => {
  let calls = 0
  const fetchImpl = async () => { calls++; return new Response('<rss/>') }
  for (const input of ['http://news.example.org/rss', 'https://127.0.0.1/rss','https://localhost/rss','https://a.internal/rss']) {
    await assert.rejects(downloadFeed(input, 1000, { lookup, fetchImpl }))
  }
  for (const addresses of [[],['10.0.0.1'],['93.184.216.34','192.168.0.1']]) {
    await assert.rejects(downloadFeed(url, 1000, { lookup: async () => addresses, fetchImpl }))
  }
  assert.equal(calls, 0)
})
test('fetch revalida DNS e URL a cada redirecionamento e aceita destino relativo', async () => {
  const hosts = []; let calls = 0
  const xml = await downloadFeed(url, 1000, { lookup: async host => { hosts.push(host); return lookup() },
    fetchImpl: async target => {
      calls++
      return calls === 1 ? new Response(null, { status: 302, headers: { location: '/rss.xml' } }) : new Response(target)
    } })
  assert.equal(xml, 'https://news.example.org/rss.xml'); assert.equal(hosts.length, 2)
  calls = 0
  await assert.rejects(downloadFeed(url, 1000, { lookup, fetchImpl: async () => {
    calls++; return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/' } })
  } }))
  assert.equal(calls, 1)
  let dns = 0; calls = 0
  await assert.rejects(downloadFeed(url, 1000, { lookup: async () => ++dns === 1 ? lookup() : ['10.0.0.1'],
    fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://private.example.org/' } }) } }))
  assert.equal(calls, 1)
})
test('fetch limita redirecionamentos e informa HTTP com falha', async () => {
  let calls = 0
  await assert.rejects(downloadFeed(url, 1000, { lookup, fetchImpl: async () => {
    calls++; return new Response(null, { status: 302, headers: { location: '/loop' } })
  } }), /Muitos redirecionamentos/)
  assert.equal(calls, 4)
  await assert.rejects(downloadFeed(url, 1000, { lookup, fetchImpl: async () => new Response('', { status: 403 }) }), /HTTP 403/)
})
test('fetch limita tamanho pelo header e durante a leitura e cancela stream grande', async () => {
  await assert.rejects(downloadFeed(url, 1000, { lookup, fetchImpl: async () => new Response('x', { headers: { 'content-length': '2000001' } }) }), /2 MB/)
  let cancelled = false
  await assert.rejects(downloadFeed(url, 1000, { lookup, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2000001)) },
    cancel() { cancelled = true },
  })) }), /2 MB/)
  assert.equal(cancelled, true)
})
test('fetch timeout cobre DNS, resposta e leitura do corpo', async () => {
  const never = () => new Promise(() => {})
  await assert.rejects(downloadFeed(url, 15, { lookup: never, fetchImpl: never }), /Tempo limite/)
  await assert.rejects(downloadFeed(url, 15, { lookup, fetchImpl: never }), /Tempo limite/)
  let cancelled = false
  await assert.rejects(downloadFeed(url, 15, { lookup, fetchImpl: async () => new Response(new ReadableStream({
    start() {}, cancel() { cancelled = true },
  })) }), /Tempo limite/)
  assert.equal(cancelled, true)
})
test('fetch mantém charset informado pela fonte', async () => {
  const xml = await downloadFeed(url, 1000, { lookup, fetchImpl: async () => new Response(new Uint8Array([0x63,0x61,0x66,0xe9]), { headers: { 'content-type': 'application/xml; charset=iso-8859-1' } }) })
  assert.equal(xml, 'café')
})
