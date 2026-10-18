import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('PostgreSQL: cache privado, lease, intervalo, expiração e pausa compartilhada', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  const key = 'https://news.google.com/articles/ArticleOne'
  const other = 'https://news.google.com/articles/ArticleTwo'
  const original = 'https://obia.nic.br/seminario-obia-2025'
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
    const migration = readFileSync(new URL('../supabase/migrations/202610180001_radar_google_cache.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration) // Idempotent; preserves existing state/data.
    const start = async (value = key, cacheOnly = false) => (await db.query('select public.observatorio_google_link_iniciar($1,$2) as result', [value, cacheOnly])).rows[0].result
    const finish = async (value, token, url = null, wait = null) => (await db.query('select public.observatorio_google_link_finalizar($1,$2,$3,$4) as result', [value, token, url, wait])).rows[0].result
    await db.exec('set role authenticated')
    await assert.rejects(start(), /permission denied/i)
    await assert.rejects(db.query('select * from private.radar_google_links'), /permission denied/i)
    await db.exec('reset role; set role anon')
    await assert.rejects(start(), /permission denied/i)
    await db.exec('reset role; set role service_role')
    await assert.rejects(db.query('select * from private.radar_google_links'), /permission denied/i)
    await assert.rejects(start('https://evil.test/a'), /inválida/)
    assert.equal((await start(key, true)).situacao, 'pendente')
    const first = await start()
    assert.equal(first.situacao, 'consultar')
    assert.equal((await start(other)).situacao, 'aguardar')
    assert.equal((await finish(other, first.token, original)).ok, false)
    assert.equal((await finish(key, '00000000-0000-0000-0000-000000000001', original)).ok, false)
    assert.equal((await finish(key, first.token, original)).ok, true)
    assert.equal((await start()).url, original)
    assert.equal((await start(other)).situacao, 'aguardar')

    await db.exec("reset role; update private.radar_google_estado set proxima_consulta_em = now() - interval '1 second'; set role service_role")
    const second = await start(other)
    assert.equal(second.situacao, 'consultar')
    const blocked = await finish(other, second.token, null, 900)
    assert.ok(Date.parse(blocked.retomar_em) > Date.now() + 880000)
    assert.equal((await start(other)).situacao, 'pausa')
    assert.equal((await start()).url, original) // Cache works during global pause.
    await db.exec('reset role')
    await db.exec(migration) // Reapplying must not clear cache or cooldown.
    await db.exec('set role service_role')
    assert.equal((await start(other)).situacao, 'pausa')
    assert.equal((await start()).url, original)

    await db.exec("reset role; update private.radar_google_links set expira_em = now() - interval '1 second'; set role service_role")
    assert.equal((await start(key, true)).situacao, 'pendente')
    assert.equal((await start()).situacao, 'pausa')
    await db.exec("reset role; update private.radar_google_estado set pausado_ate = now() - interval '1 second', proxima_consulta_em = now() - interval '1 second'; set role service_role")
    const resumed = await start()
    assert.equal(resumed.situacao, 'consultar')
    await db.exec("reset role; update private.radar_google_estado set lease_ate = now() - interval '1 second', proxima_consulta_em = now() - interval '1 second'; set role service_role")
    const renewed = await start()
    assert.equal(renewed.situacao, 'consultar')
    assert.equal((await finish(key, resumed.token, original)).ok, false)
    await assert.rejects(finish(key, renewed.token, 'https://news.google.com/articles/Anything'), /inválido/)
    assert.equal((await finish(key, renewed.token, original)).ok, true)
    assert.equal((await start()).url, original)
  } finally { await db.close() }
})
