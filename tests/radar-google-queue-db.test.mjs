import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('PostgreSQL: fila privada, atualização segura, cotas, backoff, leases e recuperação', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  const sql = file => readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
  const key = 'https://news.google.com/articles/QueuedID', url = 'https://publisher.example/noticia'
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create table public.observatorio_radar_descartes(url_key text, ativo boolean);
      create function private.radar_url_key(p_url text) returns text language sql immutable as $$ select lower(btrim(split_part(p_url,'#',1))) $$;
      create table public.observatorio_conteudos(id bigint generated always as identity primary key, url text,
        agente_origem text default 'radar',status text default 'revisao',revisao_humana boolean default false,
        aprovado_curadoria boolean default false,curadoria_por uuid,curadoria_em timestamptz,
        titulo text default 'Título preservado',resumo text default 'Resumo preservado',data_publicacao date default '2026-10-20',
        observacao_colaborador text default 'Link do Google Notícias — pendente');
      insert into public.observatorio_conteudos(url) values('${key}?oc=1');
      insert into public.observatorio_conteudos(url,status,revisao_humana) values('${key}?oc=2','publicado',true);
      insert into public.observatorio_conteudos(url,aprovado_curadoria) values('${key}?oc=3',true);
      insert into public.observatorio_conteudos(url,agente_origem) values('${key}?oc=4','manual');
      insert into public.observatorio_conteudos(url,curadoria_por) values('${key}?oc=5','00000000-0000-0000-0000-000000000001');`)
    await db.exec(sql('202610180001_radar_google_cache.sql'))
    const migration = sql('202610200001_radar_google_fila.sql')
    await db.exec(migration); await db.exec(migration)
    const reserve = async () => (await db.query('select public.observatorio_google_fila_reservar() as r')).rows[0].r
    const add = async links => (await db.query('select public.observatorio_google_fila_adicionar($1::text[]) as r', [links])).rows[0].r
    const finish = async (job, target = null, consulted = true, retry = null) => (await db.query('select public.observatorio_google_fila_finalizar($1,$2,$3,$4,$5,$6) as r', [job.chave, job.token, target, consulted, retry, 'Erro controlado'])).rows[0].r
    const due = async () => db.exec("reset role; update private.radar_google_fila_controle set proxima_em='-infinity'; update private.radar_google_fila set proxima_em=clock_timestamp()-interval '1 minute'; set role service_role")
    const rows = async () => { await db.exec('reset role'); return (await db.query('select * from public.observatorio_conteudos order by id')).rows }
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role)
      await assert.rejects(reserve(), /permission denied/)
      await assert.rejects(add([key]), /permission denied/)
      await assert.rejects(db.query('select * from private.radar_google_fila'), /permission denied/)
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    await assert.rejects(db.query('select * from private.radar_google_fila'), /permission denied/)
    await assert.rejects(add(['https://evil.test/a']), /inválido/)
    await add([key, key + '?oc=5'])
    const first = await reserve(); assert.equal(first.situacao, 'processar')
    assert.equal((await reserve()).situacao, 'aguardar')
    assert.equal((await finish({ ...first, token: '00000000-0000-0000-0000-000000000000' }, url)).ok, false)
    const success = await finish(first, url)
    assert.equal(success.estado, 'resolvido'); assert.equal(success.aplicacao.atualizados, 1)
    let contents = await rows()
    assert.equal(contents[0].url, url); assert.equal(contents[0].titulo, 'Título preservado')
    assert.equal(contents[0].status, 'revisao'); assert.equal(contents[0].revisao_humana, false)
    assert.equal(contents[0].observacao_colaborador, null)
    for (const row of contents.slice(1)) assert.match(row.url, /news.google.com/)
    await db.exec('set role service_role')
    assert.equal((await add([key])).itens[0].url, url)

    // Trigger enfileira novos itens, nunca publica ou altera dados editoriais.
    await db.exec("reset role; insert into public.observatorio_conteudos(url) values('https://news.google.com/articles/RetryID'); set role service_role")
    await due()
    let job = await reserve()
    const wait = new Date(Date.now() + 3600000).toISOString()
    let finished = await finish(job, null, true, wait)
    assert.equal(finished.tentativas, 1); assert.ok(Date.parse(finished.proxima_em) >= Date.parse(wait))
    assert.equal((await reserve()).situacao, 'aguardar')
    // Corrida com pausa global não consome tentativa de rede.
    await due(); job = await reserve(); finished = await finish(job, null, false)
    assert.equal(finished.tentativas, 1)
    for (let i = 2; i <= 5; i++) {
      await due(); job = await reserve(); finished = await finish(job)
      assert.equal(finished.tentativas, i)
    }
    assert.equal(finished.estado, 'falhou')
    await db.exec('reset role'); await db.exec(migration); await db.exec('set role service_role')
    assert.equal((await add(['https://news.google.com/articles/RetryID'])).itens[0].estado, 'falhou')

    // A pausa Google é compartilhada; reserva nem começa durante o bloqueio.
    await add(['https://news.google.com/articles/AnotherID'])
    await due()
    await db.exec("reset role; insert into private.radar_google_estado(chave,pausado_ate) values('google_news',clock_timestamp()+interval '15 minutes'); set role service_role")
    assert.equal((await reserve()).situacao, 'aguardar')
    await db.exec("reset role; update private.radar_google_estado set pausado_ate=null; set role service_role")
    job = await reserve(); assert.equal(job.situacao, 'processar')
    // Recupera reserva interrompida, mas rejeita resultado de worker antigo.
    await db.exec("reset role; update private.radar_google_fila set reserva_ate=clock_timestamp()-interval '1 second' where estado='processando'; set role service_role")
    await due(); const recovered = await reserve()
    assert.notEqual(recovered.token, job.token); assert.equal((await finish(job, url)).ok, false)
    await db.exec("reset role; insert into public.observatorio_conteudos(url) values('https://publisher.example/conflito'); set role service_role")
    const conflict = await finish(recovered, 'https://publisher.example/conflito')
    assert.equal(conflict.aplicacao.atualizados, 0)
    // Nunca sobrescreve um link que uma pessoa já corrigiu.
    await add(['https://news.google.com/articles/EditedID']); await due(); job = await reserve()
    await db.exec("reset role; insert into public.observatorio_conteudos(url) values('https://news.google.com/articles/EditedID'); update public.observatorio_conteudos set url='https://manual.example/correto' where url='https://news.google.com/articles/EditedID'; set role service_role")
    assert.equal((await finish(job, 'https://publisher.example/edited')).aplicacao.atualizados, 0)
    contents = await rows(); assert.ok(contents.some(row => row.url === 'https://manual.example/correto'))
    // Descarte do destino impede aplicar a URL e fica sinalizado como conflito.
    await db.exec('set role service_role'); await add(['https://news.google.com/articles/DiscardedID']); await due(); job = await reserve()
    await db.exec("reset role; insert into public.observatorio_conteudos(url) values('https://news.google.com/articles/DiscardedID'); insert into public.observatorio_radar_descartes values('https://publisher.example/descartado',true); set role service_role")
    const discarded = await finish(job, 'https://publisher.example/descartado')
    assert.equal(discarded.aplicacao.conflitos, 1); assert.equal(discarded.aplicacao.atualizados, 0)
    // Dispatcher: rede simulada, só invoca quando houver pendência pronta, sem ler feeds.
    await db.exec(`reset role; create schema vault; create schema net;
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      create table private.dispatch_calls(headers jsonb,body jsonb);
      create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$
        begin insert into private.dispatch_calls values(headers,body); return 7; end $$;`)
    const cron = readFileSync(new URL('../supabase/setup/radar_google_fila_cron.sql', import.meta.url), 'utf8')
    await db.exec(cron.slice(cron.indexOf('create or replace function public.observatorio_google_fila_disparar'), cron.indexOf('-- Mesmo nome')))
    await due(); await db.exec('reset role')
    const dispatch = async () => (await db.query('select public.observatorio_google_fila_disparar() as r')).rows[0].r
    assert.equal(await dispatch(), null)
    await db.exec('set role service_role'); await add(['https://news.google.com/articles/DispatchID']); await db.exec('reset role')
    await assert.rejects(dispatch(), /Token da fila ausente/)
    await db.exec("insert into vault.decrypted_secrets values('radar_agent_token','fixture-not-a-real-secret')")
    assert.equal(await dispatch(), 7)
    const dispatched = (await db.query('select * from private.dispatch_calls')).rows[0]
    assert.equal(dispatched.body.acao, 'processar_fila_google')
    assert.equal(dispatched.headers['x-radar-token'], 'fixture-not-a-real-secret')
    await db.exec("update private.radar_google_estado set pausado_ate=clock_timestamp()+interval '15 minutes'")
    // O dispatcher novo permite banco/RSS/busca mesmo durante a pausa Google.
    assert.equal(await dispatch(), 7)
    await db.exec('set role authenticated'); await assert.rejects(dispatch(), /permission denied/)
  } finally { await db.close() }
})
