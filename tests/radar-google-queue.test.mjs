import test from 'node:test'
import assert from 'node:assert/strict'
import { enqueueGoogleItems, processGoogleQueue } from '../supabase/functions/observatorio-radar/google-news-queue.mjs'
import { createRadarHandler } from '../supabase/functions/observatorio-radar/handler.mjs'

const key = 'https://news.google.com/articles/QueuedID'
const original = 'https://publisher.org/noticia'
test('fila de prévias registra somente URLs e reaproveita um destino validado', async () => {
  const items = [{ link: key, observacao_colaborador: 'Link do Google Notícias — pendente' }]
  const db = { rpc: async (name, args) => {
    assert.equal(name, 'observatorio_google_fila_adicionar'); assert.deepEqual(args.p_urls, [key])
    return { data: { ok: true, itens: [{ chave: key, url: original, estado: 'resolvido' }] } }
  }, from() { throw new Error('Prévia não cria conteúdo') } }
  await enqueueGoogleItems(db, items)
  assert.equal(items[0].link, original); assert.equal(items[0].google_news_url, key)
  assert.equal(items[0].observacao_colaborador, undefined)
})
test('fila vazia, ocupada ou em pausa não acessa rede nem finaliza reserva', async () => {
  for (const situacao of ['vazia', 'aguardar', 'ocupado']) {
    let calls = 0
    const result = await processGoogleQueue({ db: { rpc: async name => { calls++; assert.equal(name, 'observatorio_google_fila_reservar'); return { data: { situacao } } } },
      resolver() { throw new Error('Não acessar Google') } })
    assert.equal(result.processados, 0); assert.equal(calls, 1)
  }
})
function workerFixture({ resolver, known = null } = {}) {
  const calls = []
  const db = { rpc: async (name, args) => {
    calls.push({ name, args })
    if (name === 'observatorio_google_fila_reservar') return { data: { situacao: 'processar', chave: key, token: 'private-lease', url_original: known } }
    assert.equal(name, 'observatorio_google_fila_finalizar')
    return { data: { ok: true, estado: args.p_url ? 'resolvido' : 'pendente', tentativas: args.p_consultou ? 1 : 0, proxima_em: '2026-10-20T16:15:00Z', aplicacao: { atualizados: 1, conflitos: 0 } } }
  } }
  return { db, calls, run: () => processGoogleQueue({ db, resolver }) }
}
test('worker processa apenas um link, registra tentativa e não devolve lease', async () => {
  const f = workerFixture({ resolver: async (_url, opts) => { opts.onAttempt(); return original } })
  const result = await f.run()
  assert.equal(result.resolvidos, 1); assert.equal(result.atualizados, 1); assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].args.p_consultou, true)
  assert.doesNotMatch(JSON.stringify(result), /private-lease/)
})
test('destino já identificado é aplicado sem novo acesso Google', async () => {
  const f = workerFixture({ known: original, resolver() { throw new Error('Sem rede') } })
  assert.equal((await f.run()).resolvidos, 1); assert.equal(f.calls[1].args.p_consultou, false)
})
test('429 propaga prazo para fila sem repetir e corrida de pausa não consome tentativa', async () => {
  for (const attempted of [true, false]) {
    let network = 0
    const f = workerFixture({ resolver: async (_url, opts) => {
      network++; if (attempted) opts.onAttempt()
      opts.onState({ origem: 'pausa', retomar_em: '2026-10-20T16:15:00Z' }); opts.onDiagnostic('Pausa Google 429'); return null
    } })
    const result = await f.run()
    assert.equal(network, 1); assert.equal(result.resolvidos, 0)
    assert.equal(f.calls[1].args.p_retomar, '2026-10-20T16:15:00Z')
    assert.equal(f.calls[1].args.p_consultou, attempted)
  }
})
test('destino inseguro não é aplicado e erro de banco impede processamento', async () => {
  const f = workerFixture({ resolver: async () => 'https://127.0.0.1/private' })
  await f.run(); assert.equal(f.calls[1].args.p_url, null)
  await assert.rejects(processGoogleQueue({ db: { rpc: async () => ({ error: true }) } }), /migration/)
})
test('ação de worker aceita token da agenda, não aceita sessão de curador e não executa coleta/LLM', async () => {
  const env = { RADAR_AGENT_TOKEN: 'job', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' }
  const handler = createRadarHandler({ env, createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u' } } }) },
    from: table => { assert.equal(table, 'papeis_usuario'); return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { papel: 'observatorio_curador' } }) }) }) } },
    rpc: async name => { assert.equal(name, 'observatorio_google_fila_reservar'); return { data: { situacao: 'vazia' } } } }),
    download() { throw new Error('Não coletar feeds') }, fetchImpl() { throw new Error('Não chamar LLM') } })
  const run = token => handler(new Request('https://local.test', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'processar_fila_google' }) }))
  assert.equal((await run('user-session')).status, 403)
  const response = await run('job'); assert.equal(response.status, 200)
  assert.equal((await response.json()).processados, 0)
})
