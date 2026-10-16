import test from 'node:test'
import assert from 'node:assert/strict'
import { extractMetadata } from '../supabase/functions/observatorio-link/core.mjs'
import { publicationDateFromURL, validPublicationDate } from '../assets/js/portal/publication-date.js'

const articleURL = 'https://oglobo.globo.com/economia/tecnologia/noticia/2026/09/29/openai-ignorou-alertas.ghtml'
const ld = data => `<script type="application/ld+json">${JSON.stringify(data)}</script>`

test('lê datePublished de NewsArticle no corpo e preserva o dia local', () => {
  const { draft } = extractMetadata(`<head><title>Matéria</title></head><body>${ld({ '@type': 'NewsArticle', datePublished: '2026-09-29T23:30:00-03:00', dateModified: '2026-10-19T10:00:00Z' })}</body>`, articleURL)
  assert.equal(draft.data_publicacao, '2026-09-29')
})

test('prioriza dados estruturados de publicação e avisa divergência nos metadados', () => {
  const { draft, warnings } = extractMetadata(`<meta property="article:published_time" content="2026-10-19">${ld({ '@type': 'NewsArticle', datePublished: '2026-09-29' })}`, articleURL)
  assert.equal(draft.data_publicacao, '2026-09-29')
  assert.ok(warnings.some(warning => warning.includes('datas diferentes')))
})

test('escolhe o artigo correspondente à URL e ignora conteúdos relacionados', () => {
  const { draft } = extractMetadata(ld({ '@graph': [
    { '@type': 'NewsArticle', url: 'https://oglobo.globo.com/outra-materia', datePublished: '2026-10-19' },
    { '@type': ['Thing', 'NewsArticle'], mainEntityOfPage: { '@id': articleURL }, datePublished: '2026-09-29' },
  ] }), articleURL)
  assert.equal(draft.data_publicacao, '2026-09-29')
})

test('bloco inválido não impede leitura de outro JSON-LD válido', () => {
  const { draft } = extractMetadata(`<script type="application/ld+json">{invalido}</script>${ld({ '@type': 'Article', datePublished: '2026-09-28' })}`, articleURL)
  assert.equal(draft.data_publicacao, '2026-09-28')
})

test('usa metadados explícitos quando JSON-LD só tem atualização ou artigo de outra página', () => {
  const html = `<meta property="article:published_time" content="2026-09-29">${ld({ '@type': 'NewsArticle', dateModified: '2026-10-19' })}${ld({ '@type': 'NewsArticle', url: 'https://outro.example/noticia', datePublished: '2026-10-18' })}`
  assert.equal(extractMetadata(html, articleURL).draft.data_publicacao, '2026-09-29')
})

test('sugere data pelo caminho do link e exige conferência', () => {
  const { draft, warnings } = extractMetadata('<title>Matéria</title>', articleURL)
  assert.equal(draft.data_publicacao, '2026-09-29')
  assert.ok(warnings.some(warning => warning.includes('Data sugerida a partir do endereço')))
  assert.equal(draft.status, 'rascunho')
  assert.equal(draft.revisao_humana, false)
})

test('não substitui data publicada válida pela data no link', () => {
  const { draft } = extractMetadata('<meta property="article:published_time" content="2026-09-28">', articleURL)
  assert.equal(draft.data_publicacao, '2026-09-28')
})

test('rejeita datas impossíveis e ignora query string e caminho só de arquivo diário', () => {
  for (const date of ['2026-02-30', '2026-13-01', '29/09/2026', '2026-09-290']) assert.equal(validPublicationDate(date), '')
  assert.equal(validPublicationDate('2024-02-29'), '2024-02-29')
  for (const url of ['https://example.com/2026/02/30/noticia', 'https://example.com/noticia?data=2026/09/29', 'https://example.com/2026/09/29/', 'javascript:alert(1)']) assert.equal(publicationDateFromURL(url), '')
  assert.equal(publicationDateFromURL('https://example.com/2026-09-29/noticia'), '2026-09-29')
})
