import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unespArticleRoute, importUnespArticle, publicURL, createHandler } from '../supabase/functions/observatorio-link/core.mjs'

const url = 'https://www2.unesp.br/portal#!/noticias/v/id::43025/ferramenta-de-inteligencia-artificial'
const title = 'Ferramenta de inteligência artificial generativa desenvolvida na Unesp'
const sharing = `<head><meta property="og:url" content="${url}"><meta property="og:title" content="${title}">
  <meta property="og:description" content="Aplicação LegIA reconhecida em desafio internacional">
  <meta property="og:image" content="https://www2.unesp.br/Home/noticias8303/2026/04/43025/43025.jpg"></head>`
const article = `<div id="pu-wrapper-post-full-view-43025"><div><h2 class="pu-titulo-post text-wrap-pretty">${title}</h2>
  <div>Texto atualizado em 15/04/2026</div><div class="col nowrap">14/04/2026 07:55</div></div></div>
  <div class="col nowrap">21/10/2026 14:30</div>`
const xml = html => `<xjx><cmd n="js"><![CDATA[throw new Error('NUNCA EXECUTAR')]]></cmd><cmd n="as" t="idCorpo" p="innerHTML"><![CDATA[${html}]]></cmd></xjx>`
function reader(body = article, head = sharing) {
  const calls = []
  return { calls, read: async (input, options) => {
    calls.push({ input, options })
    return { url: input, html: input.includes('/sharer.php') ? head : xml(body) }
  } }
}

test('fragmento Unesp preserva notícia específica sem aceitar origens/rotas arbitrárias', () => {
  assert.equal(publicURL(url).href, url)
  assert.equal(unespArticleRoute(url).id, '43025')
  for (const input of [url.replace('www2.unesp.br', 'evil.org'), url.replace('https:', 'http:'), url.replace('43025', '0'),
    url.replace('portal#', 'portal?x=1#'), url.replace('id::43025', 'id::43025%2f..'), url.replace('www2.', 'user@www2.')]) {
    assert.equal(unespArticleRoute(input), null)
  }
  assert.equal(publicURL('https://site.org/noticia#ancora').hash, '')
})

test('importa título, resumo e data do artigo, ignorando scripts e datas de notícias relacionadas', async () => {
  const f = reader()
  const result = await importUnespArticle(url, f.read)
  assert.equal(result.draft.titulo, title)
  assert.equal(result.draft.data_publicacao, '2026-04-14')
  assert.equal(result.draft.url, url); assert.equal(result.draft.fonte, 'Portal Unesp')
  assert.equal(result.draft.status, 'rascunho'); assert.equal(result.draft.revisao_humana, false)
  assert.equal(result.date_source, 'metadata'); assert.equal(f.calls.length, 2)
  assert.equal(f.calls[0].input, 'https://www2.unesp.br/sharer.php?post=43025')
  const endpoint = new URL(f.calls[1].input)
  assert.equal(endpoint.origin, 'https://www2.unesp.br'); assert.equal(endpoint.searchParams.get('xajax'), 'exibeCorpo')
  assert.deepEqual(endpoint.searchParams.getAll('xajaxargs[]'), ['8303','','',unespArticleRoute(url).article,''])
  assert.equal(f.calls[1].options.allowXML, true)
})

test('data ausente/inválida/ambígua e corpo divergente nunca viram data sugerida da imagem', async () => {
  for (const body of [article.replace('14/04/2026', '31/02/2026'), article.replace('col nowrap', 'outra-classe'),
    article.replace(title, 'Outra notícia'), article.replace('43025', '99999'),
    article.replace('</h2>', '</h2><div class="col nowrap">15/04/2026 08:00</div>')]) {
    const result = await importUnespArticle(url, reader(body).read)
    assert.equal(result.draft.titulo, title); assert.equal(result.draft.data_publicacao, '')
    assert.ok(result.warnings.some(w => /data.*manual/i.test(w)))
  }
  const failed = reader()
  const result = await importUnespArticle(url, async (input, options) => {
    if (options?.allowXML) throw new Error('HTTP 429')
    return failed.read(input, options)
  })
  assert.equal(result.draft.data_publicacao, ''); assert.equal(result.draft.titulo, title)
})

test('não consulta XML sem menu confirmado e rejeita compartilhamento de outra notícia', async () => {
  const f = reader(article, sharing.replace('/noticias8303/', '/outro/'))
  assert.equal((await importUnespArticle(url, f.read)).draft.data_publicacao, '')
  assert.equal(f.calls.length, 1)
  await assert.rejects(importUnespArticle(url, reader(article, sharing.replaceAll('43025', '99999')).read), /não confirmou/)
  await assert.rejects(importUnespArticle(url, async input => ({ url: 'https://evil.org/page', html: sharing })), /outro domínio/)
})

test('handler e normalização do painel preservam rota; prévia não publica nem grava', async () => {
  const f = reader()
  const handler = createHandler({ authorize: async () => {}, readPage: f.read })
  const response = await handler(new Request('https://project.supabase.co/link', { method: 'POST',
    headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }))
  assert.equal(response.status, 200); assert.equal((await response.json()).draft.url, url)
  const source = readFileSync(new URL('../assets/js/portal/admin.js', import.meta.url), 'utf8')
  const functionSource = source.slice(source.indexOf('function normalizeLink('), source.indexOf('async function existingPublication('))
  const normalize = new Function(`${functionSource}; return normalizeLink`)()
  assert.equal(normalize(url), url)
  assert.equal(normalize('https://site.org/a#ancora'), 'https://site.org/a')
})
