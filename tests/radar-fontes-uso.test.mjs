import test from 'node:test'
import assert from 'node:assert/strict'
import { carregarFeeds } from '../supabase/functions/observatorio-radar/feeds.mjs'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const rows = [
  { codigo: 'ambas', busca_manual: true, busca_automatica: true },
  { codigo: 'manual', busca_manual: true, busca_automatica: false },
  { codigo: 'automatica', busca_manual: false, busca_automatica: true },
  { codigo: 'nenhuma', busca_manual: false, busca_automatica: false },
  { codigo: 'inativa', busca_manual: true, busca_automatica: true, ativo: false },
].map(row => ({ nome: row.codigo, prioridade: 1, ativo: true, url_feed: `https://${row.codigo}.example.org/rss`, ...row }))
function db(data) {
  return { from: () => ({ select: (_cols, opts) => opts?.head ? Promise.resolve({ count: data.length }) : {
    eq: () => ({ order: () => ({ order: async () => ({ data }) }) }),
  } }) }
}
test('fontes de cada modalidade respeitam ativação e seleção explícita', async () => {
  for (const [contexto, expected] of [['manual', ['ambas', 'manual']], ['automatica', ['ambas', 'automatica']]]) {
    assert.deepEqual((await carregarFeeds(db(rows), [], contexto)).feeds.map(row => row.codigo), expected)
    assert.equal((await carregarFeeds(db(rows), ['inativa', 'nenhuma'], contexto)).feeds.length, 0)
    assert.equal((await carregarFeeds(db(rows), [contexto === 'manual' ? 'automatica' : 'manual'], contexto)).feeds.length, 0)
  }
})
test('esquema antigo e contexto inválido falham sem ampliar a coleta', async () => {
  const old = { ...rows[0] }; delete old.busca_automatica
  await assert.rejects(carregarFeeds(db([old])), /migration radar_fontes_uso/)
  await assert.rejects(carregarFeeds(db(rows), [], 'outro'), /inválido/)
})
test('migration aditiva mantém política existente e padrão compatível', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610160004_radar_fontes_uso.sql', import.meta.url), 'utf8')
  for (const name of ['busca_manual', 'busca_automatica']) assert.match(sql, new RegExp(`add column if not exists ${name} boolean not null default true`))
  assert.doesNotMatch(sql, /drop|delete|disable row level|create policy/i)
})

test('SQL executa, preserva fontes inativas e não sobrescreve escolhas na reexecução', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const pg = new PGlite()
  try {
    await pg.exec("create table public.observatorio_feeds (id integer primary key, ativo boolean not null); insert into public.observatorio_feeds values (1,true),(2,false);")
    const sql = readFileSync(new URL('../supabase/migrations/202610160004_radar_fontes_uso.sql', import.meta.url), 'utf8')
    await pg.exec(sql)
    assert.deepEqual((await pg.query('select * from public.observatorio_feeds order by id')).rows, [
      { id: 1, ativo: true, busca_manual: true, busca_automatica: true },
      { id: 2, ativo: false, busca_manual: true, busca_automatica: true },
    ])
    await pg.exec('update public.observatorio_feeds set busca_automatica = false where id = 1')
    await pg.exec(sql)
    assert.equal((await pg.query('select busca_automatica from public.observatorio_feeds where id = 1')).rows[0].busca_automatica, false)
  } finally { await pg.close() }
})
