-- Execute inteiro no SQL Editor. Corrige SOMENTE observatorio-radar-08h.
-- Não cria token, não dispara coleta, não altera horário, body, limites ou outros jobs.
-- O secret Vault radar_agent_token deve ser igual ao RADAR_AGENT_TOKEN da Edge Function.
-- Encerra a transação anterior que falhou, caso a sessão ainda esteja abortada.
rollback;
begin;
do $fix$
declare
  v_job record; v_new text; v_match text[]; v_pair text[]; v_headers jsonb; v_count integer;
  v_lookup constant text := '(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''radar_agent_token'' LIMIT 1)';
  -- Formatos aceitos: headers := 'JSON'::jsonb ou headers := jsonb_build_object(somente literais).
  v_json constant text := $rx$((headers\s*(?:=>|:=)\s*)('(?:[^']|'')*')\s*::\s*(?:pg_catalog\.)?jsonb)$rx$;
  v_object constant text := $rx$((headers\s*(?:=>|:=)\s*)((?:pg_catalog\.)?jsonb_build_object\s*\((?:\s*'(?:[^']|'')*'\s*,)*\s*'(?:[^']|'')*'\s*\)))$rx$;
  v_token constant text := $rx$(('x-radar-token'\s*,\s*)('(?:[^']|'')*'))$rx$;
begin
  -- Serializa apenas execuções deste reparo, sem bloquear a tabela protegida do Cron.
  perform pg_advisory_xact_lock(252025,8);
  if not has_function_privilege(current_user,'cron.alter_job(bigint,text,text,text,text,boolean)','EXECUTE') then
    raise exception 'Sua sessão não pode executar cron.alter_job. Nenhuma alteração aplicada; não conceda permissões à tabela cron.job.';
  end if;
  select count(*) into v_count from vault.decrypted_secrets where name='radar_agent_token';
  if v_count<>1 or not exists(select 1 from vault.decrypted_secrets
    where name='radar_agent_token' and length(btrim(coalesce(decrypted_secret,'')))>0) then
    raise exception 'É necessário exatamente um secret radar_agent_token não vazio no Vault. Nenhuma alteração aplicada.';
  end if;
  select jobid,jobname,schedule,active,command,username into v_job from cron.job where jobname='observatorio-radar-08h';
  if not found then raise exception 'Job observatorio-radar-08h não encontrado. Nenhuma alteração aplicada.'; end if;
  if not coalesce(has_schema_privilege(v_job.username,'vault','USAGE') and
    has_table_privilege(v_job.username,'vault.decrypted_secrets','SELECT'),false) then
    raise exception 'O usuário do agendamento não tem leitura do Vault. Nenhuma alteração aplicada.';
  end if;
  if v_job.command !~* '^\s*select\s+net\.http_post\s*\(' then
    raise exception 'Formato de comando não reconhecido. Nenhuma alteração aplicada. Não compartilhe o comando bruto com tokens.';
  end if;
  if strpos(v_job.command,v_lookup)>0 then
    raise notice 'O job já usa a consulta dinâmica ao Vault; nenhuma alteração necessária.';
    return;
  end if;
  v_match:=regexp_match(v_job.command,v_json,'i');
  if v_match is not null then
    select count(*) into v_count from regexp_matches(v_job.command,v_json,'gi');
    if v_count<>1 then raise exception 'Cabeçalho ambíguo. Nenhuma alteração aplicada.'; end if;
    begin
      v_headers:=replace(substr(v_match[3],2,length(v_match[3])-2),'''''' ,'''')::jsonb;
    exception when others then
      raise exception 'Cabeçalho JSON não reconhecido. Nenhuma alteração aplicada.';
    end;
    if jsonb_typeof(v_headers)<>'object' or not v_headers ? 'x-radar-token' then
      raise exception 'Cabeçalho x-radar-token ausente. Nenhuma alteração aplicada.';
    end if;
    -- Remove o token literal; preserva os demais cabeçalhos sem mostrá-los.
    v_new:=replace(v_job.command,v_match[1],v_match[2]||'('||quote_literal((v_headers-'x-radar-token')::text)||
      '::jsonb || jsonb_build_object(''x-radar-token'', '||v_lookup||'))');
  else
    v_match:=regexp_match(v_job.command,v_object,'i');
    select count(*) into v_count from regexp_matches(v_job.command,v_object,'gi');
    if v_match is null or v_count<>1 then raise exception 'Formato de headers não reconhecido. Nenhuma alteração aplicada.'; end if;
    v_pair:=regexp_match(v_match[3],v_token,'i');
    select count(*) into v_count from regexp_matches(v_match[3],v_token,'gi');
    if v_pair is null or v_count<>1 then raise exception 'Token literal ausente ou ambíguo. Nenhuma alteração aplicada.'; end if;
    v_new:=replace(v_job.command,v_match[1],v_match[2]||replace(v_match[3],v_pair[1],v_pair[2]||v_lookup));
  end if;
  if not exists(select 1 from cron.job where jobid=v_job.jobid and command=v_job.command) then
    raise exception 'O comando foi alterado por outra sessão. Reexecute a conferência antes de tentar novamente.';
  end if;
  perform cron.alter_job(job_id:=v_job.jobid,command:=v_new);
  if exists(select 1 from cron.job where jobid=v_job.jobid and
    (schedule is distinct from v_job.schedule or active is distinct from v_job.active)) then
    raise exception 'Horário ou ativação mudou inesperadamente. Transação cancelada.';
  end if;
end $fix$;
-- Resultado seguro: não retorna o comando nem valores de segredos.
select jobname,schedule,active,
  command like '%vault.decrypted_secrets%' and command like '%radar_agent_token%' as token_via_vault
from cron.job where jobname='observatorio-radar-08h';
commit;
