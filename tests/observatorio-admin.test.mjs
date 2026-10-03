import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { publicURL, publicIPv4, extractMetadata, fetchPage, createHandler, ImportError } from '../supabase/functions/observatorio-link/core.mjs'

test('URL: somente HTTPS público sem credenciais, IP ou porta', () => {
  for (const value of ['http://example.com', 'https://user:pass@example.com', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://localhost', 'https://api.internal', 'https://api.local', 'https://example.com:8443', 'file:///etc/passwd', 'https://example.com.']) {
    assert.throws(() => publicURL(value), ImportError, value)
  }
  assert.equal(publicURL('https://example.com/article#heading').href, 'https://example.com/article')
})

test('SSRF: rejeita redes privadas, loopback, link local e reservadas', () => {
  for (const address of ['0.0.0.1', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.1.1', '192.168.1.1', '100.64.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::1']) assert.equal(publicIPv4(address), false, address)
  assert.equal(publicIPv4('93.184.215.14'), true)
})

test('metadados preservam a fonte, decodificam entidades e não publicam', () => {
  const { draft, warnings } = extractMetadata(`<head><title>Fallback</title>
    <meta content="Ciência &amp; IA" property="og:title">
    <meta name='description' content='Uma &lt;b&gt;pesquisa&lt;/b&gt; em IA.'>
    <meta property="og:site_name" content="Portal de pesquisa">
    <meta property="article:published_time" content="2026-10-01T13:00:00Z">
    <meta property="og:image" content="/capa.png"></head>`, 'https://example.com/materia')
  assert.equal(draft.titulo, 'Ciência & IA')
  assert.equal(draft.resumo, 'Uma pesquisa em IA.')
  assert.equal(draft.fonte, 'Portal de pesquisa')
  assert.equal(draft.imagem_url, 'https://example.com/capa.png')
  assert.equal(draft.data_publicacao, '2026-10-01')
  assert.equal(draft.status, 'rascunho')
  assert.equal(draft.revisao_humana, false)
  assert.equal(draft.origem, 'Importação')
  assert.match(warnings[0], /não gerado por IA/)
})

test('metadados ausentes não são inventados; imagem insegura e data inválida são descartadas', () => {
  const { draft, warnings } = extractMetadata('<title>Título</title><meta property="og:image" content="javascript:alert(1)"><meta name="date" content="2026-02-31">', 'https://example.com')
  assert.equal(draft.resumo, '')
  assert.equal(draft.data_publicacao, '')
  assert.equal(draft.imagem_url, '')
  assert.equal(draft.fonte, 'example.com')
  assert.equal(warnings.length, 2)
})

test('DNS privado impede o fetch, inclusive em respostas mistas', async () => {
  let calls = 0
  await assert.rejects(fetchPage('https://example.com', { resolve: async () => ['93.184.215.14', '10.0.0.1'], read: async () => { calls++ } }), /não é público/)
  assert.equal(calls, 0)
})

test('redirecionamento é revalidado e IP selecionado é fixado na conexão', async () => {
  const requests = []
  await assert.rejects(fetchPage('https://example.com', {
    resolve: async host => host === 'example.com' ? ['93.184.215.14'] : ['127.0.0.1'],
    read: async (url, ip) => { requests.push([url.hostname, ip]); return { location: 'https://private.example.net' } },
  }), /não é público/)
  assert.deepEqual(requests, [['example.com', '93.184.215.14']])
  await assert.rejects(fetchPage('https://example.com', {
    resolve: async () => ['93.184.215.14'], read: async () => ({ location: 'http://example.com' }),
  }), /HTTPS/)
})

test('limita redirecionamentos e devolve URL final', async () => {
  const resolve = async () => ['93.184.215.14']
  await assert.rejects(fetchPage('https://example.com', { resolve, read: async () => ({ location: '/again' }) }), /muitas vezes/)
  const result = await fetchPage('https://example.com', { resolve, read: async url => url.pathname === '/' ? { location: '/final' } : { html: '<title>Final</title>' } })
  assert.equal(result.url, 'https://example.com/final')
})

function req(body, token = 'Bearer user-jwt') { return new Request('https://function.example.com', { method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }

test('função exige sessão autenticada antes de ler a URL', async () => {
  let fetched = false
  const handler = createHandler({ authorize: async () => { throw new ImportError('Sessão expirada', 401) }, readPage: async () => { fetched = true } })
  assert.equal((await handler(req({ url: 'https://example.com' }, ''))).status, 401)
  assert.equal((await handler(req({ url: 'https://example.com' }))).status, 401)
  assert.equal(fetched, false)
})

test('função retorna prévia, valida corpo e não escreve no banco', async () => {
  const handler = createHandler({ authorize: async () => {}, readPage: async url => ({ url, html: '<title>Matéria</title>' }) })
  const response = await handler(req({ url: 'https://example.com' }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).draft.titulo, 'Matéria')
  assert.equal((await handler(req({ url: 'https://127.0.0.1' }))).status, 422)
  assert.equal((await handler(req({ url: 'x'.repeat(5000) }))).status, 413)
  assert.equal((await handler(new Request('https://function.example.com'))).status, 405)
  assert.equal((await handler(new Request('https://function.example.com', { method: 'OPTIONS' }))).status, 204)
})

test('painel oferece revisão, cadastro manual e entrada direta, sem fila de agentes', () => {
  const html = readFileSync(new URL('../administracao.html', import.meta.url), 'utf8')
  const js = readFileSync(new URL('../assets/js/portal/admin.js', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../observatorio.html', import.meta.url), 'utf8')
  const suggestion = readFileSync(new URL('../sugerir-observacao.html', import.meta.url), 'utf8')
  const suggestionJs = readFileSync(new URL('../assets/js/portal/observatorio-submit.js', import.meta.url), 'utf8')
  const migration = readFileSync(new URL('../supabase/migrations/202610030001_observatorio_sugestoes.sql', import.meta.url), 'utf8')
  assert.match(html, /data-link-form/)
  assert.match(html, /Preencher manualmente/)
  assert.doesNotMatch(html, /data-admin-tab="candidatos_observatorio"/)
  assert.match(js, /Usuário identificado/)
  assert.match(js, /submetido_email/)
  assert.match(js, /payload.status === 'publicado' && !payload.revisao_humana/)
  assert.match(js, /existingPublication\(payload.url, state.editing\?\.id\)/)
  assert.match(page, /administracao.html\?secao=observatorio_conteudos/)
  assert.match(page, /sugerir-observacao\.html/)
  assert.match(suggestion, /data-observation-form/)
  assert.match(suggestion, /Enviar para curadoria/)
  assert.match(suggestionJs, /origem: 'Usuário identificado'/)
  assert.match(suggestionJs, /status: 'revisao'/)
  assert.match(migration, /observatorio_colaborador_insert/)
  assert.match(migration, /status = 'revisao'/)
  assert.match(migration, /revisao_humana = false/)
  const edge = readFileSync(new URL('../supabase/functions/observatorio-link/index.ts', import.meta.url), 'utf8')
  assert.match(edge, /getUser/)
  assert.doesNotMatch(edge, /administrador/)
  assert.doesNotMatch(edge, /SERVICE_ROLE|\.insert\(|\.update\(/)
})
