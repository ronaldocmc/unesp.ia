import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateFeedDraft, radarSourceSelection } from '../assets/js/portal/radar-model.js'

const draft = { codigo: 'nova-fonte', nome: 'Nova fonte', url_feed: 'https://news.example.org/rss.xml',
  categoria: 'noticia', escopo: 'tecnologia', prioridade: 2, ativo: true }
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('cadastro de fonte normaliza espaços e URL sem alterar o original', () => {
  const result = validateFeedDraft({ ...draft, nome: ' Nova fonte ', url_feed: `${draft.url_feed}#topo` })
  assert.equal(result.nome, 'Nova fonte'); assert.equal(result.url_feed, draft.url_feed)
  assert.equal(draft.nome, 'Nova fonte'); assert.equal(result.ativo, true)
})
test('fonte rejeita campos inválidos antes de gravar', () => {
  for (const patch of [{ codigo: 'Fonte com espaços' }, { codigo: '' }, { nome: '' }, { nome: 'a'.repeat(201) },
    { categoria: 'qualquer' }, { escopo: 'qualquer' }, { prioridade: 0 }, { prioridade: 4 }, { prioridade: 1.5 },
    { url_feed: 'http://news.example.org/rss' }, { url_feed: 'javascript:alert(1)' }, { url_feed: 'https://127.0.0.1/rss' },
    { url_feed: 'https://localhost/rss' }, { url_feed: 'https://a.internal/rss' }, { url_feed: 'https://user:senha@news.example.org/rss' },
    { url_feed: 'https://news.example.org:444/rss' }]) assert.throws(() => validateFeedDraft({ ...draft, ...patch }), JSON.stringify(patch))
})
test('todas é explícito; escolher vazio nunca vira todas acidentalmente', () => {
  assert.deepEqual(radarSourceSelection('todas', []), [])
  assert.deepEqual(radarSourceSelection('todas', ['openai-news']), [])
  assert.deepEqual(radarSourceSelection('escolher', ['openai-news','openai-news','tecnoblog']), ['openai-news','tecnoblog'])
  assert.throws(() => radarSourceSelection('escolher', []), /pelo menos uma/)
  assert.throws(() => radarSourceSelection('invalido', []))
})
test('admin reutiliza seção protegida e não oferece exclusão de fontes', () => {
  const source = read('assets/js/portal/admin.js')
  assert.match(source, /const observatorioSections = \[[^\n]*'observatorio_feeds'/)
  assert.match(source, /allowedSections = \['observatorio_conteudos'\]/)
  assert.match(source, /if \(state.table === 'observatorio_feeds'\) payload = validateFeedDraft\(payload\)/)
  assert.match(source, /update\(\{ ativo: !row.ativo \}\).*\.select\('id'\)\.single\(\)/)
  const renderer = source.slice(source.indexOf('function renderFeedTable()'), source.indexOf('async function openDialog'))
  assert.doesNotMatch(renderer, /data-delete/)
  assert.match(renderer, /escapeHtml\(row.ultimo_erro/)
  const definition = source.slice(source.indexOf('observatorio_feeds: {'), source.indexOf('ecossistema_eixos: {'))
  assert.doesNotMatch(definition, /\['ultima_execucao'.*'datetime|\['ultimo_erro'.*'text'/)
  for (const page of ['administracao.html','administracao-observatorio.html']) assert.match(read(page), /data-admin-tab="observatorio_feeds"/)
})
test('Radar oferece seleção com controles acessíveis e valida antes de invocar função', () => {
  const html = read('radar.html'); const js = read('assets/js/portal/radar.js')
  assert.match(html, /name="selecao_fontes" value="todas" checked/)
  assert.match(html, /name="selecao_fontes" value="escolher"/)
  assert.match(html, /data-radar-select-all/); assert.match(html, /data-radar-clear/)
  assert.match(html, /data-radar-source-count role="status" aria-live="polite"/)
  assert.ok(js.indexOf('body.fontes = radarSourceSelection') < js.indexOf("body })"))
  assert.match(js, /input.disabled = gemini \|\| all/)
  assert.match(js, /data-radar-manage.*hidden = !\['administrador','observatorio_admin'\]/)
})

test('resultado separa novos e já cadastrados, informa vazio e versão antiga da função', () => {
  const html = read('radar.html'); const js = read('assets/js/portal/radar.js')
  assert.match(html, /<h3>Novos registros<\/h3>/)
  assert.match(html, /<h3>Já cadastrados no banco<\/h3>/)
  assert.match(html, /data-radar-existing/)
  assert.match(html, /data-radar-new-empty/)
  assert.match(js, /result.itens_ja_cadastrados \|\| \[\]/)
  assert.match(js, /Atualize observatorio-radar no Supabase/)
  assert.match(js, /sourceLink\(existingList, item.titulo, item.url\)/)
})
