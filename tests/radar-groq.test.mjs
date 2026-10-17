import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { searchGroq, groqResultLinks } from '../supabase/functions/observatorio-radar/groq.mjs'
import { radarOptions } from '../supabase/functions/observatorio-radar/gemini.mjs'
import { createRadarHandler } from '../supabase/functions/observatorio-radar/handler.mjs'
import { downloadRadarPage } from '../supabase/functions/observatorio-radar/feed-network.mjs'

const now = new Date('2026-10-16T15:00:00Z')
const url = 'https://news.example.org/article'
const options = radarOptions({ modo: 'groq', previa: true, consulta: 'IA na educação', dias: 1 })
const answer = content => ({ choices: [{ finish_reason: 'stop', message: { content } }] })
const html = (date = '2026-10-16') => `<html><head><meta property="og:title" content="Título da página"><meta property="og:description" content="Descrição da própria fonte"><meta property="og:site_name" content="Fonte original"><meta property="article:published_time" content="${date}T10:00:00-03:00"></head></html>`

test('Groq é manual em prévia, limita 3 links e não altera limites RSS/Gemini', () => {
  assert.equal(options.limite_total, 3)
  assert.equal(radarOptions({ ...options, limite_total: 20 }).limite_total, 3)
  assert.equal(radarOptions({ modo: 'gemini', consulta: 'IA', limite_total: 20 }).limite_total, 20)
  assert.equal(radarOptions({ limite_total: 300 }).limite_total, 300)
  for (const patch of [{ previa: false }, { consulta: '' }, { acao: 'listar_fontes' }]) assert.throws(() => radarOptions({ ...options, ...patch }))
})

test('parser aceita só linhas de URLs HTTPS e remove duplicados/tracking', () => {
  const links = groqResultLinks(answer(`${url}?utm_source=x\n${url}\n1. https://other.example.org/a\nhttp://bad.example.org/a\nhttps://127.0.0.1/a\n<script>https://hidden.example.org</script>\n[notícia](https://markdown.example.org/a)`), 3)
  assert.deepEqual(links, [url, 'https://other.example.org/a'])
  assert.throws(() => groqResultLinks({ choices: [{ finish_reason: 'length', message: { content: url } }] }, 3), /não terminou/)
})

test('Groq solicita browser_search obrigatório, sem JSON schema nem resumo gerado', async () => {
  let request; let read = 0
  const data = await searchGroq({ apiKey: 'private-groq-key', options, now,
    fetchImpl: async (endpoint, init) => { request = { endpoint, ...init }; return Response.json(answer(url)) },
    readPage: async link => { read++; assert.equal(link, url); return { html: html(), url: link } },
  })
  const body = JSON.parse(request.body)
  assert.equal(request.endpoint, 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal(request.headers.Authorization, 'Bearer private-groq-key')
  assert.equal(body.model, 'openai/gpt-oss-20b'); assert.equal(body.tools[0].type, 'browser_search')
  assert.equal(body.tool_choice, 'required'); assert.equal(body.reasoning_effort, 'low')
  assert.equal(body.max_completion_tokens, 2048); assert.equal(body.response_format, undefined)
  assert.ok(!request.body.includes('private-groq-key'))
  assert.equal(read, 1); assert.equal(data.items[0].titulo, 'Título da página')
  assert.equal(data.items[0].resumo, 'Descrição da própria fonte'); assert.equal(data.items[0].data, '2026-10-16')
  assert.equal(data.items[0].fonte.origem, 'Fonte original')
  assert.match(data.items[0].observacao_colaborador, /Groq/)
})

test('datas ausentes, sugeridas por URL, futuras, antigas e fontes bloqueadas não viram candidatos', async () => {
  for (const [content, link] of [
    [html('2026-10-15'), url], [html('2026-10-17'), url],
    ['<title>Título</title><meta name="description" content="Resumo">', 'https://news.example.org/2026/10/16/article'],
    ['<html>sem dados</html>', url],
  ]) {
    const result = await searchGroq({ apiKey: 'key', options, now, fetchImpl: async () => Response.json(answer(link)), readPage: async () => ({ html: content, url: link }) })
    assert.equal(result.items.length, 0); assert.ok(result.avisos.length)
    assert.equal(result.fontes_groq[0].url, link)
  }
  const blocked = await searchGroq({ apiKey: 'key', options, now, fetchImpl: async () => Response.json(answer(url)), readPage: async () => { throw new Error('private page error') } })
  assert.equal(blocked.items.length, 0); assert.ok(!JSON.stringify(blocked).includes('private page error'))
})

test('chave/modelo inválidos e erros do provedor não causam fallback ou vazamento', async () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    let calls = 0
    await assert.rejects(searchGroq({ apiKey: 'private-key', options, fetchImpl: async () => { calls++; return new Response('private-key', { status }) }, readPage: async () => assert.fail() }), error => !error.message.includes('private-key'))
    assert.equal(calls, 1)
  }
  for (const patch of [{ apiKey: '' }, { model: 'groq/compound' }]) {
    await assert.rejects(searchGroq({ apiKey: 'key', options, ...patch, fetchImpl: async () => assert.fail('Não deve chamar API') }))
  }
})

test('download HTML reutiliza validação de DNS/redirect e rejeita tipos não HTML', async () => {
  const page = await downloadRadarPage(url, 1000, { lookup: async () => ['8.8.8.8'], fetchImpl: async () => new Response(html(), { headers: { 'content-type': 'text/html' } }) })
  assert.equal(page.url, url); assert.match(page.html, /Título/)
  await assert.rejects(downloadRadarPage(url, 1000, { lookup: async () => ['127.0.0.1'], fetchImpl: async () => assert.fail() }), /público/)
  await assert.rejects(downloadRadarPage(url, 1000, { lookup: async () => ['8.8.8.8'], fetchImpl: async () => new Response('pdf', { headers: { 'content-type': 'application/pdf' } }) }), /HTML/)
})

test('handler mantém auth, ignora descartes/conhecidos antes da extração e nunca insere prévias Groq', async () => {
  const saved = []; const pages = []; let apiCalls = 0
  const known = `${url}-known`; const discarded = `${url}-discarded`
  const caller = { auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { papel: 'observatorio_curador' } }) }) }) }) }
  const db = { from: table => table === 'observatorio_radar_descartes' ? {
    select: () => ({ eq: () => ({ range: async () => ({ data: [{ url_key: discarded }] }) }) }),
  } : {
    select: () => ({ in: async () => ({ data: [{ id: 1, url: known, titulo: 'Título preservado', fonte: 'Fonte preservada' }] }) }),
    insert: rows => { saved.push(...rows); return { select: async () => ({ data: rows }) } },
  } }
  const handler = createRadarHandler({ createClient: (_url, key) => key === 'service' ? db : caller,
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon', GROQ_API_KEY: 'private-key' },
    now: () => now, fetchImpl: async () => { apiCalls++; return Response.json(answer(`${discarded}\n${known}\n${url}`)) },
    readPage: async link => { pages.push(link); return { html: html(), url: link } },
  })
  const req = (auth = true) => new Request('https://project.supabase.co/radar', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { Authorization: 'Bearer session' } : {}) }, body: JSON.stringify(options) })
  assert.equal((await handler(req(false))).status, 401); assert.equal(apiCalls, 0)
  const response = await handler(req()); assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.modo, 'groq'); assert.equal(data.previa, true)
  assert.equal(data.inseridos, 0); assert.equal(saved.length, 0); assert.deepEqual(pages, [url])
  assert.equal(data.itens_descartados_anteriormente, 1); assert.equal(data.duplicados, 1)
  assert.equal(data.itens_ja_cadastrados[0].titulo, 'Título preservado')
  assert.equal(data.previas.length, 1); assert.equal(data.previas[0].aprovado_curadoria, false)
  assert.ok(!data.fontes_groq.some(source => source.url === discarded))
})

test('painel oferece Groq com capacidade da função e sem chave no frontend', () => {
  const html = readFileSync(new URL('../radar.html', import.meta.url), 'utf8')
  const js = readFileSync(new URL('../assets/js/portal/radar.js', import.meta.url), 'utf8')
  assert.match(html, /option value="groq"/); assert.match(js, /groq_links !== 1/)
  assert.match(js, /groq \? '3'/); assert.match(js, /result.fontes_groq/)
  assert.doesNotMatch(html + js, /GROQ_API_KEY|gsk_/)
})
