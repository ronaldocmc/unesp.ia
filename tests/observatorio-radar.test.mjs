import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATALOGO_FEEDS, dedupeByLink, parseFeed, toConteudo } from '../supabase/functions/observatorio-radar/core.mjs'

test('catálogo do Agente Radar contém fontes oficiais e nacionais', () => {
  assert.ok(CATALOGO_FEEDS.length >= 20)
  for (const origem of ['OpenAI', 'Google AI', 'TechCrunch', 'UNESP (IA)', 'USP (IA)']) {
    assert.ok(CATALOGO_FEEDS.some(feed => feed.origem === origem), origem)
  }
})

test('Agente Radar lê RSS/Atom, normaliza e grava para curadoria humana', () => {
  const xml = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title><![CDATA[Nova ferramenta de IA]]></title>
      <link>https://example.org/ia</link>
      <description><![CDATA[<p>Resumo com <strong>HTML</strong>.</p>]]></description>
      <pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Duplicada</title>
      <link>https://example.org/ia</link>
      <description>Outro resumo</description>
    </item>
  </channel></rss>`
  const fonte = { origem: 'Fonte Teste', categoria: 'noticia', url: 'https://example.org/feed.xml' }
  const parsed = parseFeed(xml, fonte)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].titulo, 'Nova ferramenta de IA')
  assert.equal(parsed[0].resumo, 'Resumo com HTML.')
  assert.equal(parsed[0].data, '2026-10-06')
  const unique = dedupeByLink(parsed)
  assert.equal(unique.length, 1)
  const row = toConteudo(unique[0])
  assert.equal(row.tipo, 'Notícia monitorada')
  assert.equal(row.status, 'revisao')
  assert.equal(row.revisao_humana, false)
  assert.equal(row.aprovado_curadoria, false)
  assert.equal(row.origem, 'Agente Radar')
})

test('schema e função do Radar têm campos de curadoria e execução segura', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202610060001_observatorio_agente_radar.sql', import.meta.url), 'utf8')
  const index = readFileSync(new URL('../supabase/functions/observatorio-radar/index.ts', import.meta.url), 'utf8')
  const webIndex = readFileSync(new URL('../supabase/functions/observatorio-radar/index.web.ts', import.meta.url), 'utf8')
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')
  assert.match(migration, /aprovado_curadoria boolean not null default false/)
  assert.match(index, /RADAR_AGENT_TOKEN/)
  assert.match(webIndex, /Versão arquivo único/)
  assert.match(webIndex, /CATALOGO_FEEDS/)
  assert.match(index, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(config, /\[functions\.observatorio-radar\]\s+verify_jwt = false/)
})
