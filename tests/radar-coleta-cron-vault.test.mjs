import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('PostgreSQL: troca somente autenticação do cron por Vault, sem alterar body ou horários', {skip:!process.env.RADAR_PGLITE_MODULE}, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  const sql = readFileSync(new URL('../supabase/setup/radar_coleta_cron_vault.sql',import.meta.url),'utf8')
  try {
    await db.exec(`create schema cron; create schema vault; create schema net;
      create table cron.job(jobid bigint primary key,jobname text unique,schedule text,active boolean,command text,username text default current_user);
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      create function cron.alter_job(job_id bigint,schedule text default null,command text default null,database text default null,username text default null,active boolean default null)
      returns void language plpgsql security definer set search_path='' as $$ begin update cron.job j set command=coalesce(alter_job.command,j.command),schedule=coalesce(alter_job.schedule,j.schedule),active=coalesce(alter_job.active,j.active) where jobid=job_id; end $$;
      create table net.calls(url text,headers jsonb,body jsonb,timeout_milliseconds integer);
      create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 1000)
      returns bigint language plpgsql as $$ begin insert into net.calls values(url,headers,body,timeout_milliseconds); return 1; end $$;
      insert into vault.decrypted_secrets values('radar_agent_token','CURRENT-TEST-TOKEN');
      insert into cron.job(jobid,jobname,schedule,active,command) values(1,'observatorio-radar-08h','0 8 * * *',true,''),(2,'observatorio-radar-13h','0 13 * * *',false,'untouched');
      create role cron_operator;
      grant usage on schema cron,vault to cron_operator;
      grant select on cron.job,vault.decrypted_secrets to cron_operator;
      revoke all on function cron.alter_job(bigint,text,text,text,text,boolean) from public;
      grant execute on function cron.alter_job(bigint,text,text,text,text,boolean) to cron_operator;`)
    const bodies = [
      `select net.http_post(url := 'https://example.org/functions/v1/observatorio-radar', headers := '{"Content-Type":"application/json","x-radar-token":"OLD-TEST-TOKEN","X-Trace":"keep\\\\backslash"}'::jsonb, body := '{"limite_total":20,"limite_por_feed":3}'::jsonb, timeout_milliseconds := 60000);`,
      `SELECT net.http_post(url => 'https://example.org/functions/v1/observatorio-radar', headers => jsonb_build_object('Content-Type','application/json','x-radar-token','OLD-TEST-TOKEN','X-Trace','keep''quote'), body => jsonb_build_object('limite_total',20,'limite_por_feed',3), timeout_milliseconds => 60000);`
    ]
    for (const command of bodies) {
      await db.query('update cron.job set command=$1 where jobid=1',[command])
      await db.exec(command)
      const original=(await db.query('select * from net.calls order by ctid desc limit 1')).rows[0]
      await db.exec('set role cron_operator')
      await assert.rejects(db.query('select * from cron.job for update'),/permission denied/)
      const results = await db.exec(sql)
      await db.exec('reset role')
      const safe = results.flatMap(r=>r.rows || [])
      assert.equal(safe.find(r=>r.jobname==='observatorio-radar-08h').token_via_vault,true)
      let job=(await db.query('select * from cron.job where jobid=1')).rows[0]
      assert.equal(job.schedule,'0 8 * * *'); assert.equal(job.active,true)
      assert.ok(!job.command.includes('OLD-TEST-TOKEN')); assert.ok(!job.command.includes('CURRENT-TEST-TOKEN'))
      assert.ok(job.command.includes('vault.decrypted_secrets'))
      await db.exec(job.command)
      let call=(await db.query('select * from net.calls order by ctid desc limit 1')).rows[0]
      assert.equal(call.headers['x-radar-token'],'CURRENT-TEST-TOKEN')
      assert.deepEqual(call.headers,{...original.headers,'x-radar-token':'CURRENT-TEST-TOKEN'})
      assert.deepEqual(call.body,{limite_total:20,limite_por_feed:3}); assert.equal(call.timeout_milliseconds,60000)
      assert.equal(call.url,'https://example.org/functions/v1/observatorio-radar')
      const before=job.command; await db.exec(sql)
      assert.equal((await db.query('select command from cron.job where jobid=1')).rows[0].command,before)
      await db.exec("update vault.decrypted_secrets set decrypted_secret='ROTATED-TEST-TOKEN'")
      await db.exec(job.command)
      call=(await db.query('select * from net.calls order by ctid desc limit 1')).rows[0]
      assert.equal(call.headers['x-radar-token'],'ROTATED-TEST-TOKEN')
      await db.exec("update vault.decrypted_secrets set decrypted_secret='CURRENT-TEST-TOKEN'")
    }
    assert.deepEqual((await db.query('select schedule,active,command from cron.job where jobid=2')).rows[0],{schedule:'0 13 * * *',active:false,command:'untouched'})
    await db.query('update cron.job set command=$1 where jobid=1',["select net.http_post(url:='https://example.org/',headers:=some_unknown_function());"])
    await assert.rejects(db.exec(sql),/não reconhecido/); await db.exec('rollback')
    await db.exec("update vault.decrypted_secrets set decrypted_secret=''")
    await assert.rejects(db.exec(sql),/secret radar_agent_token não vazio/); await db.exec('rollback')
  } finally { await db.close() }
})
