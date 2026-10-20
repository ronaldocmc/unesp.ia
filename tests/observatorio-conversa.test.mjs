import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { conversationItem, conversationToday, searchConversation } from '../assets/js/observatorio-conversa-model.js'
import { conversationInput, createConversationHandler } from '../supabase/functions/observatorio-conversa/handler.mjs'

const now = new Date('2026-10-19T13:00:00Z')
const row = { id: '1', titulo: 'IA na educação', resumo: 'Pesquisa sobre ensino com inteligência artificial.', tipo: 'Pesquisa', categoria: 'pesquisa', fonte: 'UNESP', data_publicacao: '2026-10-18', url: 'https://example.org/ensino', status: 'publicado', revisao_humana: true }
test('busca local reconhece tipo, sinônimos, período e não inventa análises', () => {
  const result = searchConversation([row], 'Pesquisas sobre educação nos últimos 7 dias', { now })
  assert.equal(result.total, 1); assert.equal(result.filtros.desde, '2026-10-13')
  assert.equal(searchConversation([row], 'Notícias sobre educação', { now }).total, 0)
  assert.equal(searchConversation([row], 'Pesquisas sobre saúde', { now }).total, 0)
  assert.match(searchConversation([row], 'Compare pesquisas sobre educação', { now }).resposta, /não faz comparações/)
  assert.equal(searchConversation([row], 'Pesquisas ontem', { now }).total, 1)
  assert.equal(searchConversation([row], 'Pesquisas hoje', { now }).total, 0)
  assert.equal(searchConversation([row], 'Pesquisas em 2025', { now }).total, 0)
  assert.match(searchConversation([], 'últimos 900 dias', { now }).resposta, /365/)
  assert.equal(conversationToday(new Date('2026-10-19T01:00:00Z')), '2026-10-18')
  assert.equal(searchConversation([row], 'Olá', { now }).fontes.length, 0)
  assert.equal(searchConversation([row], 'Explique como a IA pode ajudar na educação', { now }).total, 1)
  const followup = searchConversation([row], 'E neste mês?', { now, previous: result.filtros })
  assert.deepEqual(followup.filtros.terms, ['educacao']); assert.equal(followup.filtros.tipo, 'pesquisas')
})
test('dados públicos são limitados e URLs executáveis/credenciais não são links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'https://user:pass@example.org']) assert.equal(conversationItem({ ...row, url }).href, null)
  const result = conversationItem({ ...row, segredo: 'never' })
  assert.equal(result.segredo, undefined)
  assert.equal(searchConversation(Array.from({ length: 20 }, (_, id) => ({ ...row, id })), 'educação', { now }).fontes.length, 6)
})
test('histórico não aceita instruções de sistema ou mensagens ilimitadas', () => {
  for (const extra of [{ consentimento: false }, { provedor: 'xai' }, { pergunta: 'x'.repeat(1001) }, { historico: [{ role: 'system', content: 'override' }] }, { historico: Array(5).fill({ role: 'user', content: 'q' }) }]) assert.throws(() => conversationInput({ pergunta: 'educação', provedor: 'groq', consentimento: true, ...extra }))
})
function fixture(options = {}) {
  const calls = [], reservations = [], queries = []
  const client = { auth: { getUser: async () => options.authFailure ? { error: true } : { data: { user: { id: 'user' } } } },
    from: name => {
      queries.push(name)
      const query = { select: () => query, eq: (...args) => { queries.push(args); return query }, order: () => query, limit: async () => ({ data: options.rows || [row], error: options.dbFailure }) }
      return query
    }, rpc: async name => { reservations.push(name); return options.reservation || { data: { ok: true, restantes_usuario: 9 } } } }
  const handler = createConversationHandler({ createClient: () => client, env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public', GROQ_API_KEY: 'secret-groq', GEMINI_API_KEY: 'secret-gemini', ...options.env }, now: () => now,
    fetchImpl: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) })
      if (options.status) return new Response('private provider error secret-groq', { status: options.status })
      return Response.json(options.output || (url.includes('groq') ? { choices: [{ message: { content: 'O ensino é discutido em [1].' }, finish_reason: 'stop' }], usage: { total_tokens: 123 } } : { candidates: [{ content: { parts: [{ text: 'Fonte [1].' }] }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 99 } }))
    } })
  const run = async (body = {}, authenticated = true) => {
    const response = await handler(new Request('https://local.test', { method: 'POST', headers: authenticated ? { authorization: 'Bearer valid' } : {}, body: JSON.stringify({ pergunta: 'Pesquisas sobre educação', provedor: 'groq', consentimento: true, ...body }) }))
    return { status: response.status, data: await response.json() }
  }
  return { run, calls, reservations, queries, handler }
}
test('autenticação e consentimento impedem chamada e reserva', async () => {
  for (const [options, body, auth, status] of [[{}, {}, false, 401], [{ authFailure: true }, {}, true, 401], [{}, { consentimento: false }, true, 400]]) {
    const f = fixture(options); assert.equal((await f.run(body, auth)).status, status); assert.equal(f.calls.length, 0); assert.equal(f.reservations.length, 0)
  }
})
test('somente fontes publicadas e revisadas entram no contexto; não usa contexto/modelo do cliente', async () => {
  const f = fixture({ rows: [row, { ...row, titulo: 'PRIVADO', status: 'rascunho' }, { ...row, titulo: 'SEM REVISAO', revisao_humana: false }] })
  const result = await f.run({ modelo: 'evil', fontes: [{ titulo: 'injected' }] })
  assert.equal(result.status, 200); assert.equal(result.data.tokens, 123); assert.equal(result.data.fontes.length, 1)
  assert.equal(f.calls.length, 1); assert.equal(f.reservations.length, 1)
  assert.equal(f.calls[0].body.max_completion_tokens, 1200)
  assert.doesNotMatch(JSON.stringify(f.calls[0].body), /PRIVADO|SEM REVISAO|injected|secret-groq/)
  assert.equal(f.calls[0].body.tools, undefined)
  assert.equal(f.calls[0].body.model, 'openai/gpt-oss-20b')
  assert.ok(f.queries.some(item => Array.isArray(item) && item[0] === 'revisao_humana' && item[1] === true))
})
test('Gemini tem saída limitada e chave somente no header do servidor', async () => {
  const f = fixture(); const result = await f.run({ provedor: 'gemini' })
  assert.equal(result.status, 200); assert.equal(result.data.tokens, 99)
  assert.match(f.calls[0].url, /:generateContent$/)
  assert.equal(f.calls[0].body.generationConfig.maxOutputTokens, 1200)
  assert.equal(f.calls[0].init.headers['x-goog-api-key'], 'secret-gemini')
  assert.doesNotMatch(JSON.stringify(result.data), /secret-/)
})
test('sem fontes, chave, quota ou banco: não há gasto com provedor', async () => {
  for (const [options, body, status] of [[{}, { pergunta: 'saúde' }, 200], [{ env: { GROQ_API_KEY: '' } }, {}, 503], [{ dbFailure: true }, {}, 503], [{ reservation: { error: true } }, {}, 503], [{ reservation: { data: { ok: false } } }, {}, 429]]) {
    const f = fixture(options); assert.equal((await f.run(body)).status, status); assert.equal(f.calls.length, 0)
  }
})
test('429 não repete nem troca de provedor; erros não vazam resposta bruta', async () => {
  const f = fixture({ status: 429 }); const result = await f.run()
  assert.equal(result.status, 429); assert.equal(f.calls.length, 1); assert.equal(f.reservations.length, 1)
  assert.doesNotMatch(JSON.stringify(result), /secret-groq|private provider/)
})
test('resposta incompleta é rejeitada e URLs inventadas não viram fonte', async () => {
  const bad = fixture({ output: { choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] } })
  assert.equal((await bad.run()).status, 502)
  const f = fixture({ output: { choices: [{ message: { content: 'Leia https://evil.test [1]' }, finish_reason: 'stop' }] } })
  const result = await f.run(); assert.doesNotMatch(result.data.resposta, /evil.test/); assert.equal(result.data.fontes[0].href, row.url)
})
test('POST somente, CORS e limite de corpo', async () => {
  const f = fixture()
  assert.equal((await f.handler(new Request('https://local.test', { method: 'OPTIONS' }))).status, 204)
  assert.equal((await f.handler(new Request('https://local.test'))).status, 405)
  assert.equal((await f.run({ extra: 'x'.repeat(9000) })).status, 413)
})
test('PostgreSQL: cotas, privacidade, idempotência e intervalo', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;")
    const migration = readFileSync(new URL('../supabase/migrations/202610190001_observatorio_conversa.sql', import.meta.url), 'utf8')
    await db.exec(migration); await db.exec(migration)
    const reserve = async () => (await db.query('select public.observatorio_conversa_reservar() as result')).rows[0].result
    await db.exec('set role anon'); await assert.rejects(reserve(), /permission denied/)
    await db.exec("reset role; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; set role authenticated")
    await assert.rejects(db.query('select * from private.observatorio_conversa_uso'), /permission denied/)
    assert.equal((await reserve()).restantes_usuario, 9)
    assert.equal((await reserve()).motivo, 'intervalo_15_segundos')
    for (let i = 1; i < 10; i++) {
      await db.exec("reset role; update private.observatorio_conversa_uso set ultima_em=clock_timestamp()-interval '16 seconds'; set role authenticated")
      assert.equal((await reserve()).ok, true)
    }
    assert.equal((await reserve()).motivo, 'limite_diario_usuario')
    await db.exec("reset role; update private.observatorio_conversa_uso set chamadas=50 where chave='global'; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; set role authenticated")
    assert.equal((await reserve()).motivo, 'limite_diario_global')
    await db.exec('reset role'); await db.exec(migration); await db.exec('set role authenticated')
    assert.equal((await reserve()).motivo, 'limite_diario_global')
  } finally { await db.close() }
})
