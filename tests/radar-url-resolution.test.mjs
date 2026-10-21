import test from 'node:test'
import assert from 'node:assert/strict'
import { createURLResolutionService, matchResolution, resolutionTitleScore, resolutionDomain, registerResolutionItems, indexOfficialFeed } from '../supabase/functions/observatorio-radar/url-resolution.mjs'
import { parseFeed } from '../supabase/functions/observatorio-radar/core.mjs'
import { requestRadarJSON } from '../supabase/functions/observatorio-radar/feed-network.mjs'
import { processGoogleQueue } from '../supabase/functions/observatorio-radar/google-news-queue.mjs'

const link = 'https://news.google.com/rss/articles/ValidID?oc=5'
const target = 'https://veiculo.org/ciencia/ia'
const item = { titulo: 'Universidade apresenta pesquisa inédita sobre inteligência artificial', veiculo: 'Veículo', data: '2026-10-20', data_confirmada: true, dominio_veiculo: 'veiculo.org' }
const candidate = { titulo: item.titulo, data: item.data, url: target }
const feed = { id: '00000000-0000-0000-0000-000000000001', nome: 'Veículo', dominio: 'veiculo.org', url: 'https://veiculo.org/rss' }
const xml = `<rss><channel><item><title>${item.titulo}</title><link>${target}</link><pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`
const page = { url: target, html: `<html><head><meta property="og:title" content="${item.titulo}"><meta property="article:published_time" content="2026-10-20T12:00:00Z"></head></html>` }
function fixture(overrides = {}) {
  const calls = [], logs = []
  const context = { ok: true, contexto: { ...item }, feeds: [], cache: null, ...overrides.context }
  const db = { async rpc(name, args) {
    calls.push({ name, args })
    if (overrides.rpc) { const response = await overrides.rpc(name, args); if (response) return response }
    if (name.endsWith('_contexto')) return { data: context }
    if (name.endsWith('_origem_iniciar')) return { data: { ok: true, token: 'lease' } }
    if (name.endsWith('_existentes') || name.endsWith('_documentos')) return { data: { ok: true, itens: [] } }
    return { data: { ok: true } }
  } }
  const forbidden = async () => { throw new Error('Unexpected external call') }
  const resolve = createURLResolutionService({ db, env: { RADAR_URL_DECODER_PROVIDER: 'off', ...overrides.env },
    download: forbidden, readPage: forbidden, jsonRequest: forbidden, googleResolver: forbidden,
    log: event => logs.push(event), ...overrides.dependencies })
  return { db, calls, logs, resolve, context }
}

test('URL direta não precisa de decodificação ou banco; URLs privadas/inválidas são rejeitadas', async () => {
  const f = fixture()
  assert.equal((await f.resolve(target)).url, target)
  for (const url of ['http://veiculo.org/a', 'https://127.0.0.1/a', 'https://u:p@veiculo.org/a', 'javascript:alert(1)']) assert.equal((await f.resolve(url)).url, null)
  assert.equal(f.calls.length, 0)
  assert.equal(resolutionDomain('www.veiculo.org'), 'veiculo.org')
  assert.equal(resolutionDomain('https://www.veiculo.org/'), 'veiculo.org')
})

test('título normalizado exige domínio, data exata e destino não ambíguo', () => {
  assert.equal(resolutionTitleScore(item.titulo + ' - Veículo', item.titulo, 'Veículo'), 1)
  assert.equal(matchResolution(item, [candidate], 'veiculo.org'), target)
  for (const bad of [{ ...candidate, data: '2026-10-19' }, { ...candidate, url: 'https://veiculo.org.evil.org/a' }, { ...candidate, titulo: 'Outra notícia sem relação' }]) assert.equal(matchResolution(item, [bad], 'veiculo.org'), null)
  assert.equal(matchResolution({ ...item, data_confirmada: false }, [candidate], 'veiculo.org'), null)
  assert.equal(matchResolution(item, [candidate, { ...candidate, url: 'https://veiculo.org/segunda' }], 'veiculo.org'), null)
  assert.equal(matchResolution(item, {}, 'veiculo.org'), null)
  assert.equal(resolutionTitleScore('Governo aprova novas diretrizes para uso de IA em 2025', 'Governo aprova novas diretrizes para uso de IA em 2026'), 0)
  assert.equal(resolutionTitleScore('Governo aprova novas diretrizes para uso seguro de IA nas escolas públicas', 'Governo não aprova novas diretrizes para uso seguro de IA nas escolas públicas'), 0)
})

test('cache é prioritário e consulta somente cache não acessa provedores', async () => {
  const f = fixture({ context: { cache: target } })
  assert.equal((await f.resolve(link)).metodo, 'cache')
  assert.deepEqual(f.calls.map(row => row.name), ['observatorio_resolucao_contexto'])
  const empty = fixture()
  assert.equal((await empty.resolve(link, { somenteCache: true })).url, null)
  assert.equal(empty.calls.length, 1)
})

test('banco já identificado precede RSS, busca e decoder', async () => {
  const f = fixture({ rpc: name => name.endsWith('_existentes') ? { data: { itens: [candidate] } } : null })
  assert.equal((await f.resolve(link)).metodo, 'banco')
  assert.equal(f.calls.some(row => row.name.endsWith('_origem_iniciar')), false)
})

test('índice oficial evita rede e download oficial é reaproveitado na resolução', async () => {
  const indexed = fixture({ context: { feeds: [feed] }, rpc: name => name.endsWith('_documentos') ? { data: { itens: [candidate] } } : null })
  assert.equal((await indexed.resolve(link)).metodo, 'rss_oficial')
  assert.equal(indexed.calls.some(row => row.name.endsWith('_origem_iniciar')), false)
  let downloads = 0
  const f = fixture({ context: { feeds: [feed] }, dependencies: { download: async url => { downloads++; assert.equal(url, feed.url); return xml } } })
  assert.equal((await f.resolve(link)).url, target)
  assert.equal(downloads, 1)
  assert.equal(f.calls.filter(row => row.name.endsWith('_documentos') && row.args.p_itens).length, 1)
})

test('coleta indexa apenas feed marcado oficial e links/data válidos', async () => {
  const f = fixture()
  await indexOfficialFeed(f.db, { ...feed, dominio_veiculo: 'veiculo.org', resolucao_oficial: true }, parseFeed(xml, { origem: 'Veículo' }))
  assert.equal(f.calls[0].args.p_itens[0].url, target)
  await indexOfficialFeed(f.db, { ...feed, resolucao_oficial: false }, [])
  assert.equal(f.calls.length, 1)
  await registerResolutionItems(f.db, [{ ...parseFeed(xml, { origem: 'Veículo' })[0], link }])
  assert.equal(f.calls.at(-1).args.p_itens[0].data_confirmada, true)
})

test('data ausente ou só updated não vira data de publicação confirmada', () => {
  for (const date of ['', '<updated>2026-10-20T12:00:00Z</updated>', '<pubDate>inválida</pubDate>']) {
    const rows = parseFeed(`<feed><entry><title>Notícia sobre IA</title><link href="${target}"/>${date}</entry></feed>`, { origem: 'Veículo' })
    assert.equal(rows[0].data_confirmada, false)
  }
})

test('busca opcional usa site do veículo e só confirma título/data da página', async () => {
  let searches = 0, decoded = 0
  const f = fixture({ env: { RADAR_URL_SEARCH_PROVIDER: 'brave', BRAVE_SEARCH_API_KEY: 'fixture-key', RADAR_URL_DECODER_PROVIDER: 'legacy' }, dependencies: {
    jsonRequest: async (url, init) => { searches++; const query = new URL(url); assert.equal(query.origin, 'https://api.search.brave.com'); assert.match(query.searchParams.get('q'), /^site:veiculo.org /); assert.equal(init.headers['X-Subscription-Token'], 'fixture-key'); return { web: { results: [{ url: target, title: item.titulo }] } } },
    readPage: async () => page, googleResolver: async () => { decoded++; return target },
  } })
  assert.equal((await f.resolve(link)).metodo, 'busca'); assert.equal(searches, 1); assert.equal(decoded, 0)
  assert.ok(f.logs.length)
  assert.doesNotMatch(JSON.stringify(f.logs), /fixture-key|veiculo.org|Universidade/)
})

test('busca sem chave não executa e título sem data/domínio não dispara decoder', async () => {
  let decoder = 0
  const f = fixture({ context: { contexto: { titulo: item.titulo } }, env: { RADAR_URL_SEARCH_PROVIDER: 'brave', RADAR_URL_DECODER_PROVIDER: 'legacy' }, dependencies: { googleResolver: async () => { decoder++; return target } } })
  assert.equal((await f.resolve(link)).url, null); assert.equal(decoder, 0)
})

test('busca rejeita domínio incorreto, data diferente e payload inesperado', async () => {
  for (const results of [{}, [{ url: 'https://evil.org/a', title: item.titulo }], [{ url: target, title: item.titulo }]]) {
    const f = fixture({ env: { RADAR_URL_SEARCH_PROVIDER: 'brave', BRAVE_SEARCH_API_KEY: 'fixture' }, dependencies: {
      jsonRequest: async () => ({ web: { results } }), readPage: async () => ({ ...page, html: page.html.replace('2026-10-20', '2026-10-19') }),
    } })
    assert.equal((await f.resolve(link)).url, null)
  }
})

test('decoder JavaScript é último recurso e valida destino', async () => {
  const order = []
  const f = fixture({ context: { feeds: [feed] }, env: { RADAR_URL_DECODER_PROVIDER: 'legacy' }, dependencies: {
    download: async () => { order.push('rss'); return '<rss><channel/></rss>' },
    googleResolver: async url => { order.push('decoder'); assert.equal(url, link); return target },
    readPage: async () => { order.push('pagina'); return page },
  } })
  assert.equal((await f.resolve(link)).metodo, 'google_legado')
  assert.deepEqual(order, ['rss', 'decoder', 'pagina'])
})

test('decoder legado não grava destino ainda não validado no cache compartilhado', async () => {
  const f = fixture({ env: { RADAR_URL_DECODER_PROVIDER: 'legacy' }, dependencies: {
    googleResolver: async (_url, options) => { assert.equal(options.persistOriginal, false); return target },
    readPage: async () => ({ ...page, html: page.html.replace('2026-10-20', '2026-10-19') }),
  } })
  assert.equal((await f.resolve(link)).url, null)
  assert.equal(f.calls.find(call => call.name.endsWith('_candidata')).args.p_url, target)
})

test('destino candidato já decodificado é revalidado sem outra chamada Google', async () => {
  let decoded = 0
  const f = fixture({ context: { candidata: target, candidata_metodo: 'google_legado' }, dependencies: {
    googleResolver: async () => { decoded++; return target }, readPage: async () => page,
  } })
  assert.equal((await f.resolve(link)).url, target); assert.equal(decoded, 0)
  assert.equal(f.calls.some(call => call.name.endsWith('_candidata')), false)
})

test('429 do decoder bloqueia origem Google e propaga espera', async () => {
  const f = fixture({ env: { RADAR_URL_DECODER_PROVIDER: 'legacy' }, dependencies: {
    googleResolver: async () => { throw Object.assign(new Error('secret must not be logged'), { httpStatus: 429, retryAfter: '1200' }) },
  } })
  const result = await f.resolve(link)
  assert.equal(result.url, null); assert.equal(result.consultou, true); assert.ok(Date.parse(result.retomar_em) > Date.now())
  const finish = f.calls.filter(row => row.name.endsWith('_origem_finalizar'))
  assert.equal(finish.length, 1); assert.ok(finish.every(row => row.args.p_http === 429 && row.args.p_espera === 1200))
  assert.doesNotMatch(JSON.stringify(f.logs), /secret|fixture/)
})

test('limite compartilhado impede rede e falha do banco não libera requisições', async () => {
  const retry = new Date(Date.now() + 900000).toISOString()
  const f = fixture({ context: { feeds: [feed] }, rpc: name => name.endsWith('_origem_iniciar') ? { data: { ok: false, retomar_em: retry } } : null })
  const result = await f.resolve(link)
  assert.equal(result.consultou, false); assert.equal(result.retomar_em, retry)
  const unavailable = fixture({ rpc: name => name.endsWith('_contexto') ? { error: { message: 'unavailable' } } : null })
  assert.equal((await unavailable.resolve(link)).status, 'indisponivel')
})

test('Retry-After de dois dias não é encurtado para um dia', async () => {
  const f = fixture({ context: { feeds: [feed] }, dependencies: {
    download: async () => { throw Object.assign(new Error('limited'), { httpStatus: 429, retryAfter: '172800' }) },
  } })
  const start = Date.now(), result = await f.resolve(link)
  assert.ok(Date.parse(result.retomar_em) >= start + 172800000)
  assert.equal(f.calls.find(call => call.name.endsWith('_origem_finalizar')).args.p_espera, 172800)
})

test('worker usa nova finalização e limita rodadas sem evidência, preservando esperas', async () => {
  for (const waiting of [false, true]) {
    let finished
    const db = { async rpc(name, args) {
      if (name.endsWith('_reservar')) return { data: { situacao: 'processar', chave: link.replace('/rss/', '/').split('?')[0], token: 'lease' } }
      finished = { name, args }; return { data: { ok: true, estado: 'pendente' } }
    } }
    await processGoogleQueue({ db, smartResolver: async () => ({ url: null, metodo: 'pendente', retomar_em: waiting ? new Date(Date.now() + 900000).toISOString() : null }) })
    assert.equal(finished.name, 'observatorio_resolucao_finalizar')
    assert.equal(finished.args.p_consultou, !waiting)
  }
})

test('JSON de provedor rejeita DNS privado, redirecionamento e respostas grandes', async () => {
  let calls = 0
  const fetchImpl = async () => { calls++; return Response.json({ ok: true }) }
  await assert.rejects(requestRadarJSON('https://api.org/search', {}, 100, { lookup: async () => ['127.0.0.1'], fetchImpl }), /público/)
  assert.equal(calls, 0)
  const lookup = async () => ['8.8.8.8']
  await assert.rejects(requestRadarJSON('https://api.org/search', {}, 100, { lookup, fetchImpl: async (_, init) => { assert.equal(init.redirect, 'error'); throw new Error('redirect blocked') } }), /redirect/)
  await assert.rejects(requestRadarJSON('https://api.org/search', {}, 100, { lookup, fetchImpl: async () => new Response('x'.repeat(2000001), { headers: { 'Content-Type': 'application/json' } }) }), /grande|limite/i)
  await assert.rejects(requestRadarJSON('https://api.org/search', {}, 100, { lookup, fetchImpl: async () => new Response('', { status: 429, headers: { 'Retry-After': '90' } }) }), error => error.httpStatus === 429 && error.retryAfter === '90')
})
