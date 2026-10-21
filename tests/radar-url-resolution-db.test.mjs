import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('PostgreSQL: upgrade idempotente, privilégios, metadados, fila, cotas e bloqueio por origem', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  const sql = file => readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
  const google = 'https://news.google.com/articles/SmartID', original = 'https://veiculo.org/noticia'
  const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as r`, args)).rows[0].r
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
      create function private.is_observatorio_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='yes' $$;
      create function private.is_observatorio_curador() returns boolean language sql as $$ select false $$;
      create table public.observatorio_radar_descartes(url_key text, ativo boolean);
      create function private.radar_url_key(p_url text) returns text language sql immutable as $$ select lower(btrim(split_part(p_url,'#',1))) $$;
      create table public.observatorio_feeds(id uuid primary key,nome text,instituicao text,url_feed text,ativo boolean default true);
      create table public.observatorio_conteudos(id bigint generated always as identity primary key,url text,fonte text default 'Veículo',
        agente_origem text default 'radar',status text default 'revisao',revisao_humana boolean default false,
        aprovado_curadoria boolean default false,curadoria_por uuid,curadoria_em timestamptz,
        titulo text default 'Título preservado',resumo text default 'Resumo preservado',data_publicacao date default '2026-10-20',
        observacao_colaborador text default 'Link do Google Notícias — pendente');
      insert into public.observatorio_conteudos(url) values('${google}');
      insert into public.observatorio_conteudos(url,status,revisao_humana) values('${google}?oc=5','publicado',true);`)
    await db.exec(sql('202610180001_radar_google_cache.sql'))
    await db.exec(sql('202610200001_radar_google_fila.sql'))
    const upgrade = sql('202610200002_radar_resolucao_inteligente.sql')
    await db.exec(upgrade); await db.exec(upgrade)
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role)
      await assert.rejects(rpc('observatorio_resolucao_contexto', [google]), /permission denied/)
      await assert.rejects(rpc('observatorio_resolucao_origem_iniciar', ['https://veiculo.org', 60, 10]), /permission denied/)
      await assert.rejects(db.query('select * from private.radar_url_observadas'), /permission denied/)
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    await assert.rejects(db.query('select * from private.radar_url_origens'), /permission denied/)
    await rpc('observatorio_resolucao_registrar', [JSON.stringify([{ url_rss: google, titulo: 'Título preservado', veiculo: 'Veículo', data: '2026-10-20', data_confirmada: true }])])
    const context = await rpc('observatorio_resolucao_contexto', [google])
    assert.equal(context.contexto.titulo, 'Título preservado')
    // Uma pausa do Google não impede a fila de tentar banco ou feed oficial.
    await db.exec("reset role; insert into private.radar_google_estado(chave,pausado_ate) values('google_news',clock_timestamp()+interval '1 hour'); set role service_role")
    const job = await rpc('observatorio_google_fila_reservar')
    assert.equal(job.situacao, 'processar')
    assert.equal((await rpc('observatorio_resolucao_candidata', [google, original, 'google_legado', null])).ok, false)
    assert.equal((await rpc('observatorio_resolucao_candidata', [google, original, 'google_legado', job.token])).ok, true)
    const candidateContext = await rpc('observatorio_resolucao_contexto', [google])
    assert.equal(candidateContext.candidata, original); assert.equal(candidateContext.cache, null)
    const done = await rpc('observatorio_resolucao_finalizar', [job.chave, job.token, original, 'rss_oficial', true, null, null])
    assert.equal(done.ok, true)
    await db.exec('reset role')
    let contents = (await db.query('select * from public.observatorio_conteudos order by id')).rows
    assert.equal(contents[0].url, original)
    assert.equal(contents[0].url_rss, google)
    assert.equal(contents[0].url_original, original)
    assert.equal(contents[0].url_resolucao_metodo, 'rss_oficial')
    assert.equal(contents[0].url_resolucao_status, 'resolvido')
    assert.equal(contents[0].titulo, 'Título preservado')
    assert.equal(contents[0].status, 'revisao')
    assert.equal(contents[1].url, google + '?oc=5')
    assert.equal(contents[1].url_original, null)
    // A inserção posterior de uma prévia resolvida recupera o RSS sem mudar o RPC editorial.
    await db.query('insert into public.observatorio_conteudos(url) values($1)', [original])
    contents = (await db.query('select * from public.observatorio_conteudos order by id')).rows
    assert.equal(contents[2].url_rss, google)
    assert.equal(contents[2].url_resolucao_metodo, 'rss_oficial')
    await db.exec('set role service_role')
    const known = await rpc('observatorio_resolucao_existentes', ['2026-10-20', 'veiculo.org'])
    assert.equal(known.itens[0].url, original) // Reutiliza o vínculo antes de publicação editorial.
    await db.exec('reset role')
    // Índice aceita somente títulos/datadas válidos e URLs do domínio cadastrado.
    const feedID = '00000000-0000-0000-0000-000000000009'
    await db.query("insert into public.observatorio_feeds(id,nome,url_feed,resolucao_oficial,dominio_veiculo) values($1,'Veículo','https://veiculo.org/rss',true,'veiculo.org')", [feedID])
    await db.exec('set role service_role')
    const docs = await rpc('observatorio_resolucao_documentos', [feedID, JSON.stringify([
      { url: original, titulo: 'Título preservado', veiculo: 'Veículo', data: '2026-10-20' },
      { url: 'https://evil.org/a', titulo: 'Título preservado', data: '2026-10-20' },
      { url: 'https://veiculo.org/bad-date', titulo: 'Título preservado', data: '2026-99-99' },
      { url: 'https://veiculo.org@evil.org/a', titulo: 'Título preservado', data: '2026-10-20' },
    ])])
    assert.equal(docs.itens.length, 1); assert.equal(docs.itens[0].url, original)
    const origin = 'https://veiculo.org'
    assert.equal((await rpc('observatorio_resolucao_origem_iniciar', ['https://news.google.com', 60, 100])).ok, false)
    const lease = await rpc('observatorio_resolucao_origem_iniciar', [origin, 60, 2])
    assert.equal(lease.ok, true)
    assert.equal((await rpc('observatorio_resolucao_origem_iniciar', [origin, 60, 2])).ok, false)
    assert.equal((await rpc('observatorio_resolucao_origem_finalizar', [origin, '00000000-0000-0000-0000-000000000000', 429, 900])).ok, false)
    await rpc('observatorio_resolucao_origem_finalizar', [origin, lease.token, 429, 1200])
    assert.equal((await rpc('observatorio_resolucao_origem_iniciar', [origin, 60, 2])).ok, false)
    // Outra origem permanece independente.
    assert.equal((await rpc('observatorio_resolucao_origem_iniciar', ['https://outro.org', 60, 2])).ok, true)
    await db.exec("reset role; update private.radar_url_origens set proxima_em='-infinity',pausado_ate=null,reserva_ate=null where origem='https://veiculo.org'; set role service_role")
    const second = await rpc('observatorio_resolucao_origem_iniciar', [origin, 1, 2])
    assert.equal(second.ok, true)
    await rpc('observatorio_resolucao_origem_finalizar', [origin, second.token, 200, null])
    await db.exec("reset role; update private.radar_url_origens set proxima_em='-infinity'; set role service_role")
    const quota = await rpc('observatorio_resolucao_origem_iniciar', [origin, 1, 2])
    assert.equal(quota.ok, false); assert.ok(quota.retomar_em)
    // Reprocessamento exige curadoria e não zera a pausa por origem.
    await db.exec("reset role; update private.radar_google_fila set estado='falhou',tentativas=5; set role authenticated")
    await assert.rejects(rpc('observatorio_resolucao_reprocessar', [google]), /Restrito/)
    await db.exec("select set_config('test.user','00000000-0000-0000-0000-000000000001',false); select set_config('test.admin','yes',false)")
    assert.equal((await rpc('observatorio_resolucao_reprocessar', [google])).ok, true)
    await db.exec('reset role')
    assert.equal((await db.query('select tentativas from private.radar_google_fila')).rows[0].tentativas, 0)
    assert.equal((await db.query("select quantidade from private.radar_url_origens where origem='https://veiculo.org'")).rows[0].quantidade, 2)
  } finally { await db.close() }
})
