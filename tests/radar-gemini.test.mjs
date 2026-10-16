import test from 'node:test'
import assert from 'node:assert/strict'
import { createRadarHandler } from '../supabase/functions/observatorio-radar/handler.mjs'
import { parseGeminiNews, radarOptions, searchGemini } from '../supabase/functions/observatorio-radar/gemini.mjs'

const now = new Date('2026-10-16T15:00:00Z')
const url = 'https://news.example.org/noticia'
const noticia = { url, titulo: 'Pesquisa sobre IA', resumo: 'Estudo publicado por uma universidade.', fonte: 'Universidade', data_publicacao: '2026-10-16', categoria: 'pesquisa' }
function grounded(items = [noticia]) {
  return { steps: [
    { type: 'google_search_result', result: [{ search_suggestions: '<div>Google Search</div>' }] },
    { type: 'model_output', content: [{ type: 'text', text: JSON.stringify({ noticias: items }), annotations: [{ type: 'url_citation', url, title: 'Universidade' }] }] },
  ] }
}
const options = radarOptions({ modo: 'gemini', consulta: 'IA no Brasil' })

test('opções preservam feeds como padrão e limitam Gemini a 20 resultados', () => {
  assert.equal(radarOptions({}).modo, 'feeds')
  assert.equal(radarOptions({ modo: 'gemini', consulta: 'IA', limite_total: 200 }).limite_total, 20)
  for (const body of [{ modo: 'outro' }, { modo: 'gemini' }, { previa: 'true' }, { limite_total: '20' }, { dias: -1 }, []]) assert.throws(() => radarOptions(body))
})

test('Gemini aceita apenas fontes citadas, datas reais e período solicitado', () => {
  const result = parseGeminiNews(grounded([
    noticia,
    { ...noticia, url: 'https://inventado.example.org/falso' },
    { ...noticia, data_publicacao: null },
    { ...noticia, data_publicacao: '2026-02-30' },
    { ...noticia, data_publicacao: '2026-10-17' },
    { ...noticia, data_publicacao: '2026-09-01' },
  ]), options, now)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].agente_origem, 'radar_gemini')
  assert.equal(result.descartados.sem_fonte_verificavel, 1)
  assert.equal(result.descartados.sem_data_valida, 2)
  assert.equal(result.descartados.fora_do_periodo, 2)
  assert.equal(result.fontes_gemini[0].url, url)
})

test('não aceita resposta baseada só em memória ou JSON inválido', () => {
  const noSearch = grounded()
  noSearch.steps.shift()
  assert.throws(() => parseGeminiNews(noSearch, options, now), /fontes verificáveis/)
  const invalid = grounded()
  invalid.steps[1].content[0].text = 'Não sei'
  assert.throws(() => parseGeminiNews(invalid, options, now), /formato esperado/)
})

test('request Gemini mantém chave no header, ativa busca Google e saída estruturada', async () => {
  let request
  const result = await searchGemini({ apiKey: 'server-only-key', model: 'gemini-3.8-flash', options, now,
    fetchImpl: async (endpoint, init) => { request = { endpoint, ...init }; return Response.json(grounded()) } })
  assert.equal(result.items.length, 1)
  assert.equal(request.headers['x-goog-api-key'], 'server-only-key')
  const body = JSON.parse(request.body)
  assert.equal(body.tools[0].type, 'google_search')
  assert.equal(body.store, false)
  assert.equal(body.response_format.mime_type, 'application/json')
  assert.ok(!request.endpoint.includes('server-only-key'))
  assert.ok(!request.body.includes('server-only-key'))
})

test('cota e chave ausente falham sem repetição automática ou vazamento', async () => {
  let calls = 0
  await assert.rejects(searchGemini({ apiKey: '', model: 'gemini-3.8-flash', options, fetchImpl: async () => { calls++ } }), /GEMINI_API_KEY/)
  await assert.rejects(searchGemini({ apiKey: 'secret', model: 'gemini-3.8-flash', options,
    fetchImpl: async () => { calls++; return new Response('secret', { status: 429 }) } }), /cota ou limite/)
  assert.equal(calls, 1)
})

function setup({ role = 'observatorio_curador', existing = [], key = 'gemini-secret', feed = false } = {}) {
  const calls = { fetches: 0, saved: [] }
  const db = { from: table => table === 'observatorio_radar_descartes' ? {
    select: () => ({ eq: () => ({ range: async () => ({ data: [], error: null }) }) }),
  } : table === 'observatorio_feeds' ? {
    select: (_cols, opts) => opts?.head ? Promise.resolve({ count: 1, error: null }) : ({ eq: () => ({ order: () => ({ order: async () => ({ data: [
      { id: 'f1', codigo: 'openai-news', nome: 'OpenAI', url_feed: 'https://openai.com/news/rss.xml', categoria: 'pesquisa', escopo: 'ia', ativo: true, busca_manual: true, busca_automatica: true, prioridade: 1 },
    ], error: null }) }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  } : ({
    select: () => ({ in: async () => ({ data: existing.map(url => ({ url })), error: null }) }),
    insert: rows => { calls.saved.push(...rows); return { select: async () => ({ data: rows.map((row, id) => ({ id, titulo: row.titulo, url: row.url, fonte: row.fonte })), error: null }) } },
  }) }
  const caller = { auth: { getUser: async () => ({ data: { user: { id: 'user-id' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { papel: role }, error: null }) }) }) }),
  }
  const handler = createRadarHandler({ now: () => now, createClient: (_url, key) => key === 'service-key' ? db : caller,
    download: async () => { calls.fetches++; return `<rss><item><title>Matéria</title><link>${url}</link></item></rss>` },
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key', RADAR_AGENT_TOKEN: 'job-secret', GEMINI_API_KEY: key, GEMINI_MODEL: 'gemini-3.8-flash' },
    fetchImpl: async () => { calls.fetches++; return feed ? new Response(`<rss><item><title>Matéria</title><link>${url}</link><pubDate>Fri, 16 Oct 2026 10:00:00 GMT</pubDate></item></rss>`) : Response.json(grounded()) },
  })
  return { handler, calls }
}
function req(body = { modo: 'gemini', consulta: 'IA' }, headers = { Authorization: 'Bearer user-jwt' }) {
  return new Request('https://project.supabase.co/functions/v1/observatorio-radar', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

test('curador autenticado pesquisa, e o resultado é salvo exclusivamente em revisão', async () => {
  const { handler, calls } = setup()
  const response = await handler(req({ modo: 'gemini', consulta: 'IA', status: 'publicado', revisao_humana: true }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).inseridos, 1)
  assert.equal(calls.saved[0].status, 'revisao')
  assert.equal(calls.saved[0].revisao_humana, false)
  assert.equal(calls.saved[0].aprovado_curadoria, false)
  assert.equal(calls.saved[0].agente_origem, 'radar_gemini')
})

test('Gemini também oferece prévia sem gravar no acervo', async () => {
  const { handler, calls } = setup()
  const data = await (await handler(req({ modo: 'gemini', consulta: 'IA', previa: true }))).json()
  assert.equal(data.previa, true); assert.equal(data.previas.length, 1)
  assert.equal(data.inseridos, 0); assert.equal(calls.saved.length, 0)
})

test('sessão ausente e perfil não autorizado não consomem Gemini nem escrevem', async () => {
  for (const [role, headers, status] of [['administrador', {}, 401], ['instrutor', { Authorization: 'Bearer user-jwt' }, 403]]) {
    const { handler, calls } = setup({ role })
    assert.equal((await handler(req(undefined, headers))).status, status)
    assert.equal(calls.fetches, 0)
    assert.equal(calls.saved.length, 0)
  }
})

test('agenda com token e body antigo continua usando feeds sem chave Gemini', async () => {
  const { handler, calls } = setup({ key: '', feed: true })
  const response = await handler(req({ fontes: ['OpenAI'], limite_por_feed: 3, limite_total: 20 }, { 'x-radar-token': 'job-secret' }))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.modo, 'feeds')
  assert.equal(data.feeds_processados, 1)
  assert.equal(calls.saved[0].agente_origem, 'radar')
})

test('links encontrados por modos diferentes não são novamente inseridos', async () => {
  const { handler, calls } = setup({ existing: [url] })
  const data = await (await handler(req())).json()
  assert.equal(data.duplicados, 1)
  assert.equal(data.inseridos, 0)
  assert.equal(calls.saved.length, 0)
})

test('Gemini sem chave configurada não volta silenciosamente para os feeds', async () => {
  const { handler, calls } = setup({ key: '' })
  assert.equal((await handler(req())).status, 503)
  assert.equal(calls.fetches, 0)
  assert.equal(calls.saved.length, 0)
})
