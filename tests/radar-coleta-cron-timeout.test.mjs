import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('timeout da coleta preserva configuração e não executa requisições', {skip:!process.env.RADAR_PGLITE_MODULE}, async () => {
  const {PGlite}=await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db=new PGlite()
  const sql=readFileSync(new URL('../supabase/setup/radar_coleta_cron_timeout.sql',import.meta.url),'utf8')
  try {
    await db.exec(`create schema cron; create schema net; create schema vault;
      create table cron.job(jobid bigint primary key,jobname text,schedule text,active boolean,command text);
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      insert into vault.decrypted_secrets values('radar_agent_token','TEST');
      create function cron.alter_job(job_id bigint,command text) returns void language sql security definer as $$ update cron.job set command=alter_job.command where jobid=job_id $$;
      create table net.calls(body jsonb,timeout_ms integer);
      create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$ begin insert into net.calls values(body,timeout_milliseconds); return 1; end $$;
      insert into cron.job values(1,'observatorio-radar-08h','0 8 * * *',true,''),(2,'observatorio-radar-links','* * * * *',true,'untouched');
      create role timeout_operator;
      grant usage on schema cron to timeout_operator;
      grant select on cron.job to timeout_operator;
      grant execute on function cron.alter_job(bigint,text) to timeout_operator;`)
    const base=`SELECT net.http_post(url := 'https://example.org/',headers := jsonb_build_object('x-radar-token',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='radar_agent_token')),body := '{"limite_total":20,"previa":false}'::jsonb`
    for(const ending of [');',', timeout_milliseconds := 5000);',', timeout_milliseconds => 30000) ;\n',', timeout_milliseconds := 60000);']) {
      await db.query('update cron.job set command=$1 where jobid=1',[base+ending])
      await db.exec('set role timeout_operator')
      const results=await db.exec(sql)
      await db.exec('reset role')
      assert.equal(results.flatMap(r=>r.rows||[]).find(r=>r.jobname).espera_60_segundos,true)
      const job=(await db.query('select * from cron.job where jobid=1')).rows[0]
      assert.ok(job.command.startsWith(base))
      assert.equal(job.schedule,'0 8 * * *'); assert.equal(job.active,true)
      assert.equal((await db.query('select count(*)::int as n from net.calls')).rows[0].n,0)
      await db.exec(sql)
      assert.equal((await db.query('select command from cron.job where jobid=1')).rows[0].command,job.command)
      await db.exec(job.command)
      assert.deepEqual((await db.query('select * from net.calls')).rows,[{body:{limite_total:20,previa:false},timeout_ms:60000}])
      await db.exec('truncate net.calls')
    }
    assert.equal((await db.query('select command from cron.job where jobid=2')).rows[0].command,'untouched')
    const unsupported=base+', timeout_milliseconds := 5 * 1000);'
    await db.query('update cron.job set command=$1 where jobid=1',[unsupported])
    await assert.rejects(db.exec(sql),/formato não suportado/)
    await db.exec('rollback')
    assert.equal((await db.query('select command from cron.job where jobid=1')).rows[0].command,unsupported)
  } finally { await db.close() }
})
