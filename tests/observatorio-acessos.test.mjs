import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createTracker, installAccessTracking } from '../assets/js/observatorio-acessos.mjs'

test('acessos: deduplica, expira em 30 min e permite retry após erro', async () => {
  let time = Date.parse('2026-10-22T12:00:00Z'), n = 0, stored = null, fail = false
  const calls = [], storage = { getItem: () => stored, setItem: (_, value) => { stored = value } }
  const track = createTracker({ storage, now: () => time, uuid: () => `session-${++n}`, send: async body => {
    if (fail) throw new Error('offline')
    calls.push(body)
  } })
  await Promise.all([track('visita'), track('visita')]); assert.equal(calls.length, 1)
  await track('visita'); assert.equal(calls.length, 1)
  await track('visualizacao', 1); await track('visualizacao', 1); assert.equal(calls.length, 2)
  await track('clique_original', 1); await track('clique_fallback', 1); assert.equal(calls.length, 4)
  time += 30 * 60000; await track('visita'); assert.equal(calls.length, 5); assert.equal(n, 2)
  fail = true; await track('visualizacao', 2); fail = false; await track('visualizacao', 2)
  assert.equal(calls.length, 6)
  assert.deepEqual(Object.keys(calls[0]).sort(), ['p_conteudo','p_evento','p_sessao'])
})

test('acessos: storage bloqueado não interrompe e mudança de dia conta de novo', async () => {
  let time = Date.parse('2026-10-22T02:59:59Z'), ids = 0
  const calls = []
  const track = createTracker({ now: () => time, uuid: () => `id-${++ids}`, storage: {
    getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }
  }, send: async body => calls.push(body) })
  await track('visita'); time += 2000; await track('visita')
  assert.equal(calls.length, 2); assert.equal(ids, 1)
  const disabled = createTracker({ enabled: false }); await disabled('visita')
})

test('acessos: integração observa cartões e não bloqueia cliques', () => {
  const previous = globalThis.document
  try {
    let scanned = 0
    globalThis.document = { addEventListener() {}, visibilityState: 'visible' }
    const calls = [], listeners = {}
    const card = { dataset: { accessId: '17' } }
    const root = { querySelectorAll: () => [card], addEventListener: (name, fn) => { listeners[name] = fn } }
    const tracker = installAccessTracking(root, { track: (...args) => calls.push(args), Observer: class {
      observe() { scanned++ } disconnect() {}
    } })
    tracker.scan(); assert.equal(scanned, 1)
    const event = { target: { closest: () => ({ dataset: { accessClick: 'clique_original' }, closest: () => card }) } }
    listeners.click({ ...event, type: 'click' })
    listeners.auxclick({ ...event, type: 'auxclick', button: 2 })
    listeners.auxclick({ ...event, type: 'auxclick', button: 1 })
    assert.deepEqual(calls, [['clique_original',17], ['clique_original',17]])
    const source = readFileSync(new URL('../assets/js/observatorio-acessos.mjs', import.meta.url), 'utf8')
    assert.match(source, /globalPrivacyControl/); assert.match(source, /doNotTrack/)
    assert.match(source, /intersectionRatio >= 0\.5/); assert.match(source, /1000/)
  } finally { globalThis.document = previous }
})

test('acessos: impressão exige 50%, um segundo contínuo e aba visível', () => {
  const previous = { document: globalThis.document, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout }
  try {
    let callback, timerId = 0
    const timers = new Map(), calls = [], listeners = {}
    globalThis.setTimeout = (fn, ms) => { assert.equal(ms, 1000); timers.set(++timerId, fn); return timerId }
    globalThis.clearTimeout = id => timers.delete(id)
    globalThis.document = { visibilityState: 'visible', addEventListener: (event, fn) => { listeners[event] = fn } }
    const card = { dataset: { accessId: '7' }, isConnected: true }
    const root = { querySelectorAll: () => [card], addEventListener() {} }
    installAccessTracking(root, { track: (...args) => calls.push(args), Observer: class {
      constructor(fn) { callback = fn } observe() {} disconnect() {}
    } })
    const enter = ratio => callback([{ target: card, isIntersecting: true, intersectionRatio: ratio }])
    enter(0.49); assert.equal(timers.size, 0)
    enter(0.5); assert.equal(timers.size, 1); assert.equal(calls.length, 0)
    enter(0); assert.equal(timers.size, 0)
    enter(1); globalThis.document.visibilityState = 'hidden'; listeners.visibilitychange(); assert.equal(timers.size, 0)
    globalThis.document.visibilityState = 'visible'; enter(0.75)
    const fn = [...timers.values()][0]; fn()
    assert.deepEqual(calls, [['visualizacao', 7]])
  } finally { Object.assign(globalThis, previous) }
})

test('PostgreSQL: acessos privados, deduplicação, IDs e relatório autorizado', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema private;
      create function private.is_observatorio_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='yes' $$;
      create table public.observatorio_conteudos(id bigint primary key,titulo text,status text,revisao_humana boolean);
      insert into public.observatorio_conteudos values(1,'Publicação','publicado',true),(2,'Rascunho','rascunho',false),(3,'Outra publicação','publicado',true);`)
    const sql = readFileSync(new URL('../supabase/migrations/202610220001_observatorio_acessos.sql', import.meta.url), 'utf8')
    await db.exec(sql); await db.exec(sql)
    const id = '12345678-1234-4234-8234-123456789abc'
    const record = async (event, content = 0) => (await db.query('select public.observatorio_acesso_registrar($1,$2,$3) as ok', [id,event,content])).rows[0].ok
    await db.exec('set role anon')
    assert.equal(await record('visita'), true); assert.equal(await record('visita'), false)
    assert.equal(await record('bad'), false); assert.equal(await record('visita', 1), false)
    assert.equal(await record('visualizacao', 2), false); assert.equal(await record('visualizacao', 99), false)
    assert.equal(await record('visualizacao', 1), true); assert.equal(await record('visualizacao', 1), false)
    assert.equal(await record('clique_original', 1), true); assert.equal(await record('clique_fallback', 1), true)
    await assert.rejects(db.query('select * from private.observatorio_acessos_dia'), /permission denied/)
    await assert.rejects(db.query("select public.observatorio_acessos_resumo(current_date,current_date)"), /permission denied/)
    await db.exec('reset role; set role authenticated')
    await assert.rejects(db.query('select * from private.observatorio_acessos_recibos'), /permission denied/)
    await assert.rejects(db.query("select public.observatorio_acessos_resumo(current_date,current_date)"), /Acesso restrito/)
    await db.exec("select set_config('test.admin','yes',false)")
    const report = (await db.query("select public.observatorio_acessos_resumo(current_date-1,current_date+1) as r")).rows[0].r
    assert.equal(report.diario.length, 4); assert.equal(report.mensal.length, 4); assert.equal(report.conteudos.length, 3)
    assert.equal(report.diario.reduce((sum, row) => sum + Number(row.quantidade), 0), 4)
    await assert.rejects(db.query("select public.observatorio_acessos_resumo(current_date,current_date+500)"), /Selecione/)
    await db.exec('reset role')
    await db.exec(`insert into private.observatorio_acessos_recibos values(current_date-5,'${id}','visita',0)`)
    await record('visualizacao', 1) // Duplicata não faz manutenção; novo evento abaixo sim.
    await db.query('select public.observatorio_acesso_registrar($1,$2,$3)', ['87654321-1234-4234-8234-123456789abc','visita',0])
    assert.equal((await db.query('select count(*)::int as n from private.observatorio_acessos_recibos where dia<current_date-3')).rows[0].n, 0)
    await db.exec(`insert into private.observatorio_acessos_recibos
      select (clock_timestamp() at time zone 'America/Sao_Paulo')::date,'${id}'::uuid,'visualizacao',n from generate_series(100,600) n`)
    assert.equal(await record('visualizacao', 3), false)
  } finally { await db.close() }
})
