import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('PostgreSQL: monitor distingue execução, espera, consulta e resolução sem contar duplicatas', {skip:!process.env.RADAR_PGLITE_MODULE}, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  const sql = file => readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')
  const rpc = async (name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as r`,args)).rows[0].r
  const key = 'https://news.google.com/articles/MonitorID'
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function private.is_observatorio_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='yes' $$;
      create function private.is_observatorio_curador() returns boolean language sql as $$ select false $$;
      create table public.observatorio_radar_descartes(url_key text,ativo boolean);
      create function private.radar_url_key(p_url text) returns text language sql immutable as $$ select lower(btrim(split_part(p_url,'#',1))) $$;
      create table public.observatorio_feeds(id uuid primary key,nome text,instituicao text,url_feed text,ativo boolean default true);
      create table public.observatorio_conteudos(id bigint generated always as identity primary key,url text,fonte text default 'Veículo',
        agente_origem text default 'radar',status text default 'revisao',revisao_humana boolean default false,
        aprovado_curadoria boolean default false,curadoria_por uuid,curadoria_em timestamptz,
        titulo text default 'Título preservado',resumo text default 'Resumo',data_publicacao date default current_date,
        observacao_colaborador text default 'Link do Google Notícias — pendente');`)
    await db.exec(sql('202610180001_radar_google_cache.sql'))
    await db.exec(sql('202610200001_radar_google_fila.sql'))
    await db.exec(sql('202610200002_radar_resolucao_inteligente.sql'))
    const monitor = sql('202610250002_radar_worker_monitor.sql')
    await db.exec(monitor); await db.exec(monitor)
    await db.exec('set role anon')
    await assert.rejects(rpc('observatorio_worker_situacao'),/permission denied/)
    await db.exec('reset role; set role authenticated')
    await assert.rejects(rpc('observatorio_worker_situacao'),/Acesso restrito/)
    await assert.rejects(db.query('select * from private.radar_worker_eventos'),/permission denied/)
    await db.exec("reset role; select set_config('test.admin','yes',false)")
    assert.equal((await rpc('observatorio_worker_situacao')).ultima_execucao,null)
    await db.exec('set role service_role')
    assert.equal((await rpc('observatorio_google_fila_reservar')).situacao,'vazia')
    await assert.rejects(db.query('select * from private.radar_worker_eventos'),/permission denied/)
    await db.exec(`reset role; insert into private.radar_google_fila(google_key) values('${key}'); set role service_role`)
    let job = await rpc('observatorio_google_fila_reservar')
    assert.equal(job.situacao,'processar')
    let done = await rpc('observatorio_resolucao_finalizar',[key,job.token,null,'pendente',false,null,'Aguardando cota'])
    assert.equal(done.tentativas,0)
    assert.equal((await rpc('observatorio_google_fila_reservar')).situacao,'aguardar')
    await db.exec('reset role')
    let summary = await rpc('observatorio_worker_situacao')
    assert.equal(summary.execucoes_hoje,3); assert.equal(summary.sem_consulta_hoje,1)
    assert.equal(summary.tentativas_hoje,0); assert.equal(summary.resolvidos_hoje,0)
    assert.equal(summary.ultimo_resultado.motivo,'Aguardando cota')
    const release = async () => db.exec("reset role; update private.radar_google_fila set proxima_em=now()-interval '1 minute'; update private.radar_google_fila_controle set proxima_em=now()-interval '1 minute'; set role service_role")
    await release(); job = await rpc('observatorio_google_fila_reservar')
    await rpc('observatorio_resolucao_finalizar',[key,job.token,null,'google_legado',true,null,'HTTP 429'])
    assert.equal((await rpc('observatorio_resolucao_finalizar',[key,job.token,null,'google_legado',true,null,'Duplicada'])).ok,false)
    await db.exec('reset role'); summary = await rpc('observatorio_worker_situacao')
    assert.equal(summary.tentativas_hoje,1); assert.equal(summary.resolvidos_hoje,0); assert.ok(summary.ultima_tentativa)
    await release(); job = await rpc('observatorio_google_fila_reservar')
    done = await rpc('observatorio_resolucao_finalizar',[key,job.token,'https://example.org/noticia','rss_oficial',true,null,null])
    assert.equal(done.estado,'resolvido')
    await db.exec("reset role; update private.radar_google_fila set estado='resolvido',atualizado_em=now()")
    summary = await rpc('observatorio_worker_situacao')
    assert.equal(summary.tentativas_hoje,2); assert.equal(summary.resolvidos_hoje,1)
    assert.equal(summary.pendentes,0); assert.equal(summary.em_processamento,0); assert.ok(summary.ultima_resolucao)
    assert.ok(!JSON.stringify(summary).includes(job.token)); assert.ok(!JSON.stringify(summary).includes(key))
    await db.exec("insert into private.radar_google_fila(google_key,estado,url_original) values('https://news.google.com/articles/CacheID','resolvido','https://example.org/cache')")
    summary = await rpc('observatorio_worker_situacao')
    assert.equal(summary.resolvidos_hoje,2); assert.equal(summary.tentativas_hoje,2)
  } finally { await db.close() }
})
