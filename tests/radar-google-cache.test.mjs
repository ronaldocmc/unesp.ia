import test from 'node:test'
import assert from 'node:assert/strict'
import { createSharedGoogleResolver, googleNewsCacheKey, googleRetrySeconds } from '../supabase/functions/observatorio-radar/google-news-cache.mjs'
import { resolveGoogleNewsLink, resolveGoogleNewsItems } from '../supabase/functions/observatorio-radar/google-news.mjs'
import { downloadRadarPage } from '../supabase/functions/observatorio-radar/feed-network.mjs'
import { createRadarHandler } from '../supabase/functions/observatorio-radar/handler.mjs'

const link = 'https://news.google.com/rss/articles/AU_yqLfakeID?oc=5'
const original = 'https://obia.nic.br/seminario-obia-2025'
const now = () => new Date('2026-10-18T15:00:00Z')

function storage() {
  const rows = new Map(); const calls = []; let state = { blocked: false, active: false }
  return {
    rows, calls, state,
    db: { rpc: async (name, args) => {
      calls.push({ name, args })
      if (name === 'observatorio_google_link_iniciar') {
        if (rows.has(args.p_chave)) return { data: { situacao: 'cache', url: rows.get(args.p_chave) } }
        if (args.p_somente_cache) return { data: { situacao: 'pendente' } }
        if (state.blocked) return { data: { situacao: 'pausa', retomar_em: '2026-10-18T15:15:00Z' } }
        if (state.active) return { data: { situacao: 'aguardar', retomar_em: '2026-10-18T15:00:45Z' } }
        state.active = true
        return { data: { situacao: 'consultar', token: 'lease' } }
      }
      assert.equal(name, 'observatorio_google_link_finalizar')
      state.active = false
      if (args.p_espera_segundos !== null) state.blocked = true
      if (args.p_url) rows.set(args.p_chave, args.p_url)
      return { data: { ok: true, retomar_em: state.blocked ? '2026-10-18T15:15:00Z' : null } }
    } },
  }
}

test('cache normaliza variantes de URL sem misturar IDs e valida Retry-After', () => {
  const key = googleNewsCacheKey(link)
  assert.equal(key, 'https://news.google.com/articles/AU_yqLfakeID')
  assert.equal(googleNewsCacheKey('https://news.google.com/read/AU_yqLfakeID?hl=pt-BR'), key)
  assert.equal(googleNewsCacheKey('https://news.google.com/articles/another'), 'https://news.google.com/articles/another')
  for (const url of ['http://news.google.com/articles/id','https://news.google.com.evil.test/articles/id','https://user:pass@news.google.com/articles/id','https://news.google.com:8080/articles/id']) assert.equal(googleNewsCacheKey(url), null)
  assert.equal(googleRetrySeconds(null), 900)
  assert.equal(googleRetrySeconds('bad'), 900)
  assert.equal(googleRetrySeconds('120'), 120)
  assert.equal(googleRetrySeconds('Sun, 18 Oct 2026 15:03:00 GMT', now().getTime()), 180)
  assert.equal(googleRetrySeconds('0'), 1)
})

test('segunda sessão reutiliza cache persistente mesmo durante pausa global', async () => {
  const db = storage(); let external = 0; let metadata
  const resolve = async () => { external++; return original }
  assert.equal(await createSharedGoogleResolver({ db: db.db, resolve, now })(link), original)
  db.state.blocked = true
  const otherSession = createSharedGoogleResolver({ db: db.db, resolve, now })
  assert.equal(await otherSession(link.replace('/rss/articles/','/read/'), { onState: value => { metadata = value } }), original)
  assert.equal(external, 1); assert.equal(metadata.origem, 'cache')
})

test('429 grava pausa compartilhada, não repete e não impede uso de links em cache', async () => {
  const db = storage(); let external = 0; let message; let meta
  const resolver = createSharedGoogleResolver({ db: db.db, now, resolve: async (_link, options) => {
    external++; options.onRateLimit('180'); options.onDiagnostic('pagina: HTTP 429'); return null
  } })
  assert.equal(await resolver(link), null)
  assert.equal(db.calls.at(-1).args.p_espera_segundos, 180)
  assert.equal(await resolver(link + '2', { onDiagnostic: value => { message = value }, onState: value => { meta = value } }), null)
  assert.equal(external, 1); assert.match(message, /Pausa compartilhada/); assert.equal(meta.origem, 'pausa')
  db.rows.set(googleNewsCacheKey(link), original)
  assert.equal(await resolver(link), original); assert.equal(external, 1)
})

test('busca em lote consulta somente cache e não consome nenhuma chamada Google', async () => {
  const db = storage()
  db.rows.set(googleNewsCacheKey(link), original)
  const resolver = createSharedGoogleResolver({ db: db.db, resolve() { throw new Error('Não acessar Google na busca') } })
  const items = [{ link }, { link: 'https://news.google.com/articles/NewID' }]
  await resolveGoogleNewsItems(items, { resolve: resolver, somenteCache: true })
  assert.equal(items[0].link, original)
  assert.match(items[1].observacao_colaborador, /Conversão pendente/)
  assert.ok(db.calls.every(call => call.name === 'observatorio_google_link_iniciar' && call.args.p_somente_cache))
})

test('storage indisponível e lease concorrente impedem tráfego externo', async () => {
  let external = 0
  const resolve = () => { external++; throw new Error('Não deveria acessar') }
  const unavailable = createSharedGoogleResolver({ db: { rpc: async () => ({ error: {} }) }, resolve })
  let diagnostic
  assert.equal(await unavailable(link, { onDiagnostic: value => { diagnostic = value } }), null)
  assert.match(diagnostic, /migration/)
  const db = storage(); db.state.active = true
  assert.equal(await createSharedGoogleResolver({ db: db.db, resolve })(link), null)
  assert.equal(external, 0)
})

test('Google 429 na página preserva Retry-After até o callback de pausa', async () => {
  let value
  const result = await resolveGoogleNewsLink(link, {
    readPage: (url, ms) => downloadRadarPage(url, ms, {
      lookup: async () => ['142.250.0.1'],
      fetchImpl: async () => new Response('Rate limited', { status: 429, headers: { 'Retry-After': '3600' } }),
    }),
    onRateLimit: header => { value = header },
  })
  assert.equal(result, null); assert.equal(value, '3600')
})

test('429 no RPC, falha comum e destino inválido não viram entradas de cache', async () => {
  let header
  const result = await resolveGoogleNewsLink(link, {
    readPage: async () => ({ url: link, html: '<div data-n-a-ts="123" data-n-a-sg="sig"></div>' }),
    fetchImpl: async () => new Response('Rate limited', { status: 429, headers: { 'Retry-After': '45' } }),
    onRateLimit: value => { header = value },
  })
  assert.equal(result, null); assert.equal(header, '45')
  for (const resolve of [async () => { throw new Error('secret') }, async () => 'https://127.0.0.1/private']) {
    const db = storage()
    assert.equal(await createSharedGoogleResolver({ db: db.db, resolve })(link), null)
    assert.equal(db.rows.size, 0)
    assert.equal(db.calls.at(-1).args.p_espera_segundos, null)
    assert.equal(db.state.active, false)
  }
})

test('duas requisições simultâneas não iniciam duas conversões Google', async () => {
  const db = storage(); let requests = 0, release, entered
  const gate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { entered = resolve })
  const resolver = createSharedGoogleResolver({ db: db.db, resolve: async () => { requests++; entered(); await gate; return original } })
  const first = resolver(link)
  await started
  assert.equal(await resolver('https://news.google.com/articles/OtherID'), null)
  assert.equal(requests, 1)
  release(); assert.equal(await first, original)
})

test('429 sem Retry-After aplica 15 minutos sem retentativas', async () => {
  const db = storage(); let calls = 0
  const resolver = createSharedGoogleResolver({ db: db.db, resolve: async (_url, options) => {
    calls++; options.onRateLimit(null); return null
  } })
  await resolver(link); await resolver(link)
  assert.equal(calls, 1)
  assert.equal(db.calls.find(call => call.name === 'observatorio_google_link_finalizar').args.p_espera_segundos, 900)
})

test('handler RSS usa somente cache para link Google e mantém a prévia sem gravar conteúdo', async () => {
  const cached = storage(); cached.rows.set(googleNewsCacheKey(link), original)
  const feed = { id: '1', codigo: 'google', nome: 'Google IA', url_feed: 'https://news.google.com/rss/search?q=IA',
    ativo: true, busca_manual: true, busca_automatica: true, escopo: 'ia', categoria: 'noticia', prioridade: 1,
    resolucao_oficial: true, dominio_veiculo: 'veiculo.org' }
  const db = { rpc: cached.db.rpc, from: table => {
    if (table === 'observatorio_radar_descartes') return { select: () => ({ eq: () => ({ range: async () => ({ data: [] }) }) }) }
    if (table === 'observatorio_feeds') return {
      select: (_columns, options) => options?.head ? Promise.resolve({ count: 1 }) : {
        eq: () => ({ order: () => ({ order: async () => ({ data: [feed] }) }) }),
      }, update: () => ({ eq: async () => ({}) }),
    }
    if (table === 'observatorio_conteudos') return { select: () => ({ in: async () => ({ data: [] }) }), insert() { throw new Error('Não salvar prévia') } }
    throw new Error('Tabela inesperada')
  } }
  const handler = createRadarHandler({ createClient: () => db, now,
    env: { RADAR_AGENT_TOKEN: 'job', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' },
    download: async () => `<rss><item><title>Inteligência artificial</title><link>${link}</link></item></rss>`,
    readPage() { throw new Error('Não converter link durante busca') }, fetchImpl() { throw new Error('Não acessar Google ou IA') },
  })
  const result = await handler(new Request('https://project.supabase.co/radar', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-radar-token': 'job' }, body: JSON.stringify({ previa: true, limite_total: 3 }),
  }))
  assert.equal(result.status, 200)
  const data = await result.json()
  assert.equal(data.previas[0].url, original)
  assert.equal(data.inseridos, 0)
  const reads = cached.calls.filter(call => call.name === 'observatorio_google_link_iniciar')
  assert.equal(reads.length, 1)
  assert.equal(reads[0].args.p_somente_cache, true)
  assert.equal(cached.calls.filter(call => call.name === 'observatorio_resolucao_registrar').length, 1)
  assert.equal(cached.calls.filter(call => call.name === 'observatorio_resolucao_documentos').length, 1)
  assert.ok(data.avisos.some(message => message.includes('índice de links')))
})
