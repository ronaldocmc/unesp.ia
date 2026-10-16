import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRadarHandler } from '../supabase/functions/observatorio-radar/handler.mjs'
import { avaliarRelevanciaIA, scoreIA, classificarRelevancia } from '../supabase/functions/observatorio-radar/relevance.mjs'
import { downloadFeed } from '../supabase/functions/observatorio-radar/feed-network.mjs'
import { carregarFeeds } from '../supabase/functions/observatorio-radar/feeds.mjs'

const general = { id: 'g', codigo: 'geral', nome: 'Geral', url_feed: 'https://news.example.org/feed', categoria: 'noticia', escopo: 'tecnologia', ativo: true, prioridade: 2 }
const ai = { ...general, id: 'a', codigo: 'ia', nome: 'Especializada', escopo: 'ia', prioridade: 1 }
const xml = titles => `<rss>${titles.map((title, i) => `<item><title>${title}</title><link>https://news.example.org/${i}</link><description>Resumo</description></item>`).join('')}</rss>`
function setup({ feeds = [general], failCatalog = false, failUpdate = false, existing = [], download = async () => xml(['Receita de bolo','OpenAI apresenta recurso','Inteligência artificial na educação']) } = {}) {
  const calls = { saved: [], updates: [], urls: [] }
  const db = { from: table => table === 'observatorio_feeds' ? {
    select: (_columns, opts) => opts?.head ? Promise.resolve({ count: feeds.length, error: null }) : {
      eq: () => ({ order: () => ({ order: async () => ({ data: feeds, error: failCatalog ? { code: '42501' } : null }) }) }),
    },
    update: value => ({ eq: async (_key, id) => { calls.updates.push({ id, ...value }); return { error: failUpdate ? {} : null } } }),
  } : {
    select: () => ({ in: async () => ({ data: existing.map(url => ({ url })), error: null }) }),
    insert: rows => { calls.saved.push(...rows); return { select: async () => ({ data: rows, error: null }) } },
  } }
  const handler = createRadarHandler({ createClient: () => db,
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private', RADAR_AGENT_TOKEN: 'test' },
    now: () => new Date('2026-10-16T15:00:00Z'),
    download: async (...args) => { calls.urls.push(args[0]); return download(...args) },
  })
  return { db, handler, calls }
}
const req = body => new Request('https://project.supabase.co/functions/v1/observatorio-radar', {
  method: 'POST', headers: { 'x-radar-token': 'test', 'content-type': 'application/json' }, body: JSON.stringify(body),
})

test('score: acentos, limites de palavra, contexto e maior peso no título', () => {
  assert.equal(scoreIA({ titulo: 'Inteligência artificial' }), 5)
  assert.equal(scoreIA({ resumo: 'inteligencia artificial' }), 2)
  assert.equal(scoreIA({ titulo: 'OpenAI' }), 4)
  assert.equal(scoreIA({ resumo: 'OpenAI' }), 1)
  for (const titulo of ['praia', 'saia', 'chair', 'AI', 'IA', 'OpenAIsomething']) assert.equal(scoreIA({ titulo }), 0, titulo)
  assert.ok(scoreIA({ titulo: 'Novos modelos de IA' }) >= 5)
  assert.equal(scoreIA({ titulo: 'OpenAI OpenAI OpenAI' }), 4)
})
test('normalização, limiar mais rigoroso para geral e confiança temática por escopo', () => {
  const item = { titulo: 'OpenAI apresenta ferramenta', link: 'https://news.example.org/a' }
  assert.equal(avaliarRelevanciaIA(item, general).relevancia_ia, 40)
  assert.equal(avaliarRelevanciaIA(item, general).aceito, true)
  assert.equal(avaliarRelevanciaIA(item, { escopo: 'geral' }).aceito, false)
  assert.equal(avaliarRelevanciaIA({ ...item, titulo: 'Outra notícia' }, ai).relevancia_ia, 90)
  assert.equal(avaliarRelevanciaIA({ ...item, link: '' }, ai).aceito, false)
  assert.equal(avaliarRelevanciaIA(item, general, 10).aceito, false)
  for (const [score, category] of [[0,'baixa'],[39,'baixa'],[40,'revisar'],[60,'relevante'],[80,'alta'],[100,'alta']]) assert.equal(classificarRelevancia(score), category)
})
test('catálogo só ativo, ordenado, selecionável por código, nome, categoria e URL', async () => {
  const { db } = setup({ feeds: [general, { ...ai, ativo: false }, { ...ai, id: 'b', codigo: 'ativo' }] })
  const all = await carregarFeeds(db)
  assert.deepEqual(all.feeds.map(feed => feed.codigo), ['ativo','geral'])
  assert.equal(all.catalogados, 3); assert.equal(all.ativos, 2)
  for (const value of ['geral','Geral','noticia',general.url_feed]) assert.ok((await carregarFeeds(db, [value])).feeds.some(feed => feed.codigo === 'geral'))
  await assert.rejects(carregarFeeds(db, 'geral'), /fontes deve/)
})
test('filtra antes dos limites, salva score e mantém revisão; debug opcional', async () => {
  const { handler, calls } = setup()
  const result = await (await handler(req({ fontes: ['geral'], limite_por_feed: 1, limite_total: 1, debug: true }))).json()
  assert.equal(result.itens_lidos, 3); assert.equal(result.itens_relevantes_ia, 2)
  assert.equal(result.itens_descartados_nao_ia, 1); assert.equal(result.itens_fora_limites, 1)
  assert.equal(result.inseridos, 1); assert.equal(result.exemplos_descartados[0].score_bruto, 0)
  assert.equal(calls.saved[0].titulo, 'OpenAI apresenta recurso')
  assert.equal(calls.saved[0].relevancia_ia, 40)
  for (const key of ['destaque','revisao_humana','aprovado_curadoria']) assert.equal(calls.saved[0][key], false)
  assert.equal(calls.saved[0].status, 'revisao')
  assert.equal(calls.updates[0].quantidade_relevante, 2)
  const normal = await (await handler(req({}))).json()
  assert.equal('exemplos_descartados' in normal, false)
})
test('debug limitado a 20 e nenhum item irrelevante vai ao banco', async () => {
  const { handler, calls } = setup({ download: async () => xml(Array(50).fill('Futebol hoje')) })
  const data = await (await handler(req({ debug: true }))).json()
  assert.equal(data.exemplos_descartados.length, 20); assert.equal(data.inseridos, 0)
  assert.equal(data.itens_descartados_nao_ia, 50); assert.equal(calls.saved.length, 0)
})
test('prioridade domina a ordem quando todos os feeds retornam candidatos', async () => {
  const { handler, calls } = setup({ feeds: [general, ai], download: async () => xml(['OpenAI apresenta recurso']) })
  const data = await (await handler(req({ limite_total: 1 }))).json()
  assert.equal(data.inseridos, 1)
  assert.equal(calls.saved[0].fonte, 'Especializada')
  assert.equal(data.feeds[0].codigo, 'ia')
})
test('erro isolado de rede e de atualização não interrompe outros feeds; prioridade antes do limite total', async () => {
  const { handler, calls } = setup({ feeds: [general, ai], failUpdate: true,
    download: async url => { if (url === general.url_feed) throw new Error('HTTP 403'); return xml(['Artigo']) },
  })
  // URLs diferentes para distinguir as fontes no mock.
  ai.url_feed = 'https://ai.example.org/rss'
  try {
    const data = await (await handler(req({ limite_total: 1 }))).json()
    assert.equal(data.quantidade_feeds_com_erro, 1); assert.equal(data.feeds_com_erro[0].erro, 'HTTP 403')
    assert.equal(data.inseridos, 1); assert.equal(data.avisos.length, 2)
    assert.equal(calls.saved[0].fonte, 'Especializada')
  } finally { ai.url_feed = general.url_feed }
})
test('listagem para painel não acessa fontes nem grava; migration ausente falha sem fallback', async () => {
  const { handler, calls } = setup()
  const data = await (await handler(req({ acao: 'listar_fontes' }))).json()
  assert.equal(data.fontes[0].codigo, 'geral'); assert.equal(calls.urls.length, 0); assert.equal(calls.updates.length, 0)
  assert.equal((await setup({ failCatalog: true }).handler(req({}))).status, 503)
  assert.equal((await handler(req({ fontes: ['inexistente'] }))).status, 400)
})
test('deduplicação é aplicada aos candidatos aprovados na triagem', async () => {
  const { handler, calls } = setup({ existing: ['https://news.example.org/1'] })
  const data = await (await handler(req({}))).json()
  assert.equal(data.duplicados, 1); assert.equal(data.inseridos, 1)
  assert.equal(calls.saved[0].titulo, 'Inteligência artificial na educação')
})
test('download recusa URL interna, DNS privado e redirecionamento privado; fixa IP público', async () => {
  let calls = 0
  const read = async (_url, address) => { calls++; assert.equal(address, '93.184.216.34'); return { xml: '<rss/>' } }
  await assert.rejects(downloadFeed('https://127.0.0.1/feed', 1000, { read }))
  await assert.rejects(downloadFeed('https://news.example.org/rss', 1000, { lookup: async () => ['10.0.0.1'], read }))
  assert.equal(calls, 0)
  assert.equal(await downloadFeed('https://news.example.org/rss', 1000, { lookup: async () => ['93.184.216.34'], read }), '<rss/>')
  await assert.rejects(downloadFeed('https://news.example.org/rss', 1000, { lookup: async () => ['93.184.216.34'], read: async () => ({ location: 'https://127.0.0.1/' }) }))
})
test('migrations restringem escrita e score sem reescrever dados existentes', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610160001_observatorio_feeds.sql', import.meta.url), 'utf8')
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on public.observatorio_feeds from public, anon, authenticated/)
  assert.match(sql, /private.is_observatorio_admin/)
  assert.match(sql, /on conflict do nothing/)
  const relevance = readFileSync(new URL('../supabase/migrations/202610160002_observatorio_relevancia.sql', import.meta.url), 'utf8')
  assert.match(relevance, /check \(relevancia_ia between 0 and 100\)/)
})
test('arquivo único é JavaScript válido sem colisões de nomes entre módulos', () => {
  const source = readFileSync(new URL('../supabase/functions/observatorio-radar/index.web.ts', import.meta.url), 'utf8')
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
