-- Execute inteiro. Altera SOMENTE o tempo de espera de observatorio-radar-08h.
-- Não dispara coleta, não muda body, fontes, token, horário ou ativação.
rollback;
begin;
do $fix$
declare
  j record; novo text; m text[];
begin
  perform pg_advisory_xact_lock(252025,8);
  select jobid,command into j from cron.job where jobname='observatorio-radar-08h';
  if not found then raise exception 'Agendamento não encontrado. Nenhuma alteração aplicada.'; end if;
  if j.command !~* '^\s*select\s+net\.http_post\s*\('
     or j.command not like '%vault.decrypted_secrets%'
     or j.command not like '%radar_agent_token%'
     or j.command !~ '\)\s*;?\s*$' then
    raise exception 'Formato ou autenticação não reconhecidos. Nenhuma alteração aplicada. Não compartilhe o comando com segredos.';
  end if;
  -- Reconhece apenas argumento numérico final. Outros formatos exigem revisão.
  m:=regexp_match(j.command,'(,\s*timeout_milliseconds\s*(?::=|=>)\s*)([0-9]+)(\s*\)\s*;?\s*)$','i');
  if m is not null then
    novo:=left(j.command,length(j.command)-length(m[1]||m[2]||m[3]))||m[1]||'60000'||m[3];
  elsif j.command ~* 'timeout_milliseconds' then
    raise exception 'Tempo de espera em formato não suportado. Nenhuma alteração aplicada.';
  else
    novo:=regexp_replace(j.command,'\)(\s*;?\s*)$',', timeout_milliseconds := 60000)\1');
  end if;
  if not exists(select 1 from cron.job where jobid=j.jobid and command=j.command) then
    raise exception 'Agendamento alterado por outra sessão. Refaça a conferência.';
  end if;
  if novo is distinct from j.command then
    perform cron.alter_job(job_id:=j.jobid,command:=novo);
  end if;
end $fix$;
-- Resultado seguro: não mostra comando nem token.
select jobname,active,schedule,
  command ~* 'timeout_milliseconds\s*(?::=|=>)\s*60000\s*\)\s*;?\s*$' as espera_60_segundos
from cron.job where jobname='observatorio-radar-08h';
commit;
