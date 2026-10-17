import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFeed, toConteudo } from '../supabase/functions/observatorio-radar/core.mjs'
import { decodeGoogleNewsID, resolveGoogleNewsLink, resolveGoogleNewsItems } from '../supabase/functions/observatorio-radar/google-news.mjs'

function legacy(url) {
  const bytes = Buffer.from(url)
  const length = bytes.length < 128 ? [bytes.length] : [(bytes.length & 127) | 128, bytes.length >> 7]
  return 'https://news.google.com/rss/articles/' + Buffer.concat([Buffer.from([8,19,34,...length]), bytes, Buffer.from([210,1,0])]).toString('base64url')
}
const article = 'https://obia.nic.br/noticia/inteligencia-artificial'

test('Google RSS: veículo vem de source e o endereço legado é resolvido sem rede', async () => {
  const link = legacy(article)
  const feed = { origem: 'Google Notícias', categoria: 'pesquisa', escopo: 'ia' }
  const [item] = parseFeed(`<rss><item><title>Inteligência artificial</title><link>${link}</link><source url="https://obia.nic.br/">OBIA &amp; NIC.br</source></item></rss>`, feed)
  assert.equal(item.fonte.origem, 'OBIA & NIC.br')
  assert.equal(feed.origem, 'Google Notícias')
  assert.equal(decodeGoogleNewsID(link), article)
  await resolveGoogleNewsItems([item], { fetchImpl() { throw new Error('Não deveria chamar rede') } })
  assert.equal(toConteudo(item).url, article)
  assert.equal(item.google_news_url, link)
  const [normal] = parseFeed('<item><title>Notícia</title><link>https://publisher.example/noticia</link><source>Outro</source></item>', feed)
  assert.equal(normal.fonte.origem, 'Google Notícias')
})

test('IDs inválidos, privados, credenciais e agregador não são tratados como original', () => {
  for (const url of ['http://example.org/a','https://127.0.0.1/a','https://localhost/a','https://user:pass@example.org/a','https://news.google.com/a','https://obia.nic.br/']) assert.equal(decodeGoogleNewsID(legacy(url)), null)
  assert.equal(decodeGoogleNewsID('https://news.google.com/rss/articles/bad'), null)
  assert.equal(decodeGoogleNewsID(legacy(article).replace('news.google.com','news.google.com.evil.test')), null)
})

const opaque = 'https://news.google.com/rss/articles/AU_yqLfakeID'
test('ID opaco: extrai somente a resposta RPC certa, sem cookies ou segredos', async () => {
  const result = await resolveGoogleNewsLink(opaque, {
    readPage: async () => ({ url: opaque, html: '<div data-n-a-ts="12345" data-n-a-sg="signature"></div>' }),
    fetchImpl: async (url, options) => {
      assert.equal(new URL(url).hostname, 'news.google.com')
      assert.equal(options.redirect, 'error')
      assert.deepEqual(Object.keys(options.headers), ['Content-Type'])
      const frame = JSON.parse(new URLSearchParams(options.body).get('f.req'))
      assert.equal(frame[0][0][0], 'Fbv4je')
      assert.equal(JSON.parse(frame[0][0][1])[2], 'AU_yqLfakeID')
      return new Response(")]}'\n\n123\n" + JSON.stringify([['wrb.fr','Fbv4je',JSON.stringify(['garturlres',article])]]))
    },
  })
  assert.equal(result, article)
})

test('bloqueio, consentimento e RPC inesperado preservam link com aviso; cache evita repetição', async () => {
  assert.equal(await resolveGoogleNewsLink(opaque, { readPage: async () => ({ url: opaque, html: 'Consent required' }) }), null)
  assert.equal(await resolveGoogleNewsLink(opaque, { readPage: async () => { throw new Error('HTTP 429') } }), null)
  const items = [{ link: opaque }, { link: opaque }, { link: article }]
  let calls = 0
  await resolveGoogleNewsItems(items, { resolve: async () => { calls++; return null } })
  assert.equal(calls, 1)
  assert.equal(items[0].link, opaque)
  assert.match(items[0].observacao_colaborador, /original não identificado/)
  assert.equal(items[2].observacao_colaborador, undefined)
})

test('limita a dez resoluções externas por execução', async () => {
  let calls = 0
  const items = Array.from({ length: 14 }, (_, n) => ({ link: opaque + n }))
  await resolveGoogleNewsItems(items, { resolve: async () => { calls++; return null } })
  assert.equal(calls, 10)
  assert.ok(items.every(item => item.observacao_colaborador))
})

test('redirecionamento público é aceito; retorno privado ou frames errados não viram original', async () => {
  assert.equal(await resolveGoogleNewsLink(opaque, { readPage: async () => ({ url: article, html: '' }) }), article)
  assert.equal(await resolveGoogleNewsLink(opaque, { readPage: async () => ({ url: 'https://127.0.0.1/admin', html: '' }) }), null)
  for (const frame of [ ['wrb.fr','OtherRPC',JSON.stringify(['garturlres',article])], ['wrb.fr','Fbv4je',JSON.stringify(['garturlres','https://localhost/a'])] ]) {
    assert.equal(await resolveGoogleNewsLink(opaque, {
      readPage: async () => ({ url: opaque, html: '<div data-n-a-ts="123" data-n-a-sg="sig"></div>' }),
      fetchImpl: async () => new Response(JSON.stringify([frame])),
    }), null)
  }
})

test('falha do resolvedor não interrompe o lote e leitura comum não usa rede extra', async () => {
  const items = [{ link: opaque }, { link: article }]
  await resolveGoogleNewsItems(items, { resolve: async () => { throw new Error('Rede indisponível') } })
  assert.equal(items[0].link, opaque)
  assert.match(items[0].observacao_colaborador, /não identificado/)
  assert.equal(items[1].link, article)
})

test('diagnóstico distingue bloqueio, timeout e formato sem expor erro bruto', async () => {
  for (const [message, expected] of [['HTTP 429', /pagina: HTTP 429/], ['Tempo limite ao acessar feed.', /pagina: tempo limite/], ['secret-private-token stack https://internal.test', /pagina: falha de rede ou validação/]]) {
    const items = [{ link: opaque }]
    await resolveGoogleNewsItems(items, { readPage: async () => { throw new Error(message) } })
    assert.match(items[0].observacao_colaborador, expected)
    assert.doesNotMatch(items[0].observacao_colaborador, /secret-private-token|internal\.test|stack/)
  }
  const items = [{ link: opaque }]
  await resolveGoogleNewsItems(items, { readPage: async () => ({ url: opaque, html: 'Consent' }) })
  assert.match(items[0].observacao_colaborador, /sem parâmetros/)
})
