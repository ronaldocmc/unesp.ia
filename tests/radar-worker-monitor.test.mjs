import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('PostgreSQL: monitor e retry controlado preservam pausas, limites e autorização', {skip:!process.env.RADAR_PGLITE_MODULE}, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  const sql = file => readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')
  const rpc = async (name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as r`,args)).rows[0].r
  const key = 'https://news.google.com/articles/MonitorID'
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
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
    const retry = sql('202610250003_radar_retry_controlado.sql')
    await db.exec(retry); await db.exec(retry)
    assert.equal((await db.query("select count(*)::int as n from private.radar_google_fila where estado='resolvido'")).rows[0].n,2)
    const policy = async (reason,n) => (await db.query('select private.radar_retry_politica($1,$2) as p',[reason,n])).rows[0].p
    assert.equal((await policy('google_legado: HTTP 429; sem resultado confirmado.',1)).espera_segundos,900)
    assert.equal((await policy('HTTP 503',2)).espera_segundos,600)
    assert.equal((await policy('timeout',3)).espera_segundos,480)
    assert.equal((await policy('Título da página não corresponde ao título do RSS; revisão necessária.',1)).automatico,false)
    assert.equal((await policy('Título ausente ou insuficiente',0)).classe,'dados_ausentes')
    assert.equal((await policy('HTTP 403',1)).automatico,false)
    assert.equal((await policy('erro desconhecido',1)).automatico,false)
    const retryKey = 'https://news.google.com/articles/RetryID'
    await db.exec(`insert into private.radar_google_fila(google_key) values('${retryKey}');
      insert into private.radar_url_origens(origem,pausado_ate) values('https://news.google.com',now()+interval '1 day');`)
    const pause = (await db.query("select pausado_ate from private.radar_url_origens where origem='https://news.google.com'")).rows[0].pausado_ate
    // Cinco consultas reais, com backoff crescente, nunca zeradas automaticamente.
    for (let n=1;n<=5;n++) {
      await release(); job=await rpc('observatorio_google_fila_reservar')
      assert.equal(job.chave,retryKey)
      const resume = new Date(Date.now()+12*3600000).toISOString()
      done=await rpc('observatorio_resolucao_finalizar',[retryKey,job.token,null,'google_legado',true,resume,'google_legado: HTTP 429; sem resultado confirmado.'])
      assert.equal(done.tentativas,n); assert.equal(done.estado,n===5?'falhou':'pendente')
      assert.ok(Date.parse(done.proxima_em)>=Date.parse(resume))
    }
    await db.exec('reset role')
    const failedBefore = (await db.query('select estado,tentativas from private.radar_google_fila where google_key=$1',[retryKey])).rows[0]
    assert.deepEqual(failedBefore,{estado:'falhou',tentativas:5})
    await db.exec('set role authenticated')
    // Mesmo um papel administrativo requer identidade autenticada para solicitar novo ciclo.
    await assert.rejects(rpc('observatorio_resolucao_reprocessar',[retryKey]),/Restrito à curadoria/)
    await db.exec("select set_config('test.user','12345678-1234-4234-8234-123456789abc',false); select set_config('test.admin','',false)")
    await assert.rejects(rpc('observatorio_resolucao_reprocessar',[retryKey]),/Restrito à curadoria/)
    await db.exec("select set_config('test.admin','yes',false)")
    const requested = await rpc('observatorio_resolucao_reprocessar',[retryKey]); assert.equal(requested.ok,true)
    assert.ok(Date.parse(requested.proxima_em)>Date.now()+11*3600000)
    assert.equal((await rpc('observatorio_resolucao_reprocessar',[retryKey])).ok,false)
    assert.equal((await rpc('observatorio_resolucao_reprocessar',[key])).ok,false) // Não altera resolvidos.
    await assert.rejects(db.query('select * from private.radar_reprocessamentos'),/permission denied/)
    await db.exec('reset role')
    assert.equal((await db.query("select pausado_ate from private.radar_url_origens where origem='https://news.google.com'")).rows[0].pausado_ate.getTime(),pause.getTime())
    const audit=(await db.query('select tentativas_anteriores,motivo_anterior from private.radar_reprocessamentos')).rows
    assert.equal(audit.length,1); assert.equal(audit[0].tentativas_anteriores,5); assert.match(audit[0].motivo_anterior,/429/)
    // Esperar cota não consome tentativa; dado faltante vai para revisão sem gastar consulta.
    await release(); job=await rpc('observatorio_google_fila_reservar')
    done=await rpc('observatorio_resolucao_finalizar',[retryKey,job.token,null,'pendente',false,null,'Aguardando intervalo, cota ou pausa compartilhada do provedor.'])
    assert.equal(done.estado,'pendente'); assert.equal(done.tentativas,0)
    await release(); job=await rpc('observatorio_google_fila_reservar')
    done=await rpc('observatorio_resolucao_finalizar',[retryKey,job.token,null,'pendente',false,null,'Título ausente ou insuficiente; aguardando dados da notícia, sem consumir tentativa.'])
    assert.equal(done.estado,'falhou'); assert.equal(done.tentativas,0)
    await db.exec('reset role')
    assert.equal((await db.query('select count(*)::int as n from private.radar_reprocessamentos')).rows[0].n,1)
  } finally { await db.close() }
})
