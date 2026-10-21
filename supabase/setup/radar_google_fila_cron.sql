-- Execute somente DEPOIS da migration radar_google_fila e do deploy da função.
-- No Supabase Vault cadastre radar_agent_token com o MESMO valor do Secret
-- RADAR_AGENT_TOKEN da Edge Function. Não coloque esse valor neste arquivo/Git/chat.
begin;
do $$ begin
  if not exists(select 1 from pg_extension where extname='pg_cron')
    or not exists(select 1 from pg_extension where extname='pg_net') then
    raise exception 'Ative Cron (pg_cron) e pg_net nas integrações do Supabase.';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then raise exception 'Ative o Supabase Vault.'; end if;
  if not exists(select 1 from vault.decrypted_secrets where name='radar_agent_token' and length(decrypted_secret)>0) then
    raise exception 'Cadastre radar_agent_token no Vault com o mesmo valor de RADAR_AGENT_TOKEN da função.';
  end if;
end $$;

create or replace function public.observatorio_google_fila_disparar()
returns bigint language plpgsql security definer set search_path='' as $$
declare v_token text; v_id bigint; v_now timestamptz:=clock_timestamp();
begin
  -- A pausa Google não bloqueia as camadas de banco, feed oficial e busca.
  if exists(select 1 from private.radar_google_fila_controle where id=true and proxima_em>v_now)
    or exists(select 1 from private.radar_google_fila where estado='processando' and reserva_ate>v_now) then return null; end if;
  if not exists(select 1 from private.radar_google_fila where
    (estado='pendente' and tentativas<5 and proxima_em<=v_now)
    or (estado='processando' and reserva_ate<=v_now)) then return null; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name='radar_agent_token' limit 1;
  if v_token is null or v_token='' then raise exception 'Token da fila ausente no Vault.'; end if;
  select net.http_post(
    url:='https://brdjzyutqdakabaolxiy.supabase.co/functions/v1/observatorio-radar',
    headers:=jsonb_build_object('Content-Type','application/json','x-radar-token',v_token),
    body:=jsonb_build_object('acao','processar_fila_google'),timeout_milliseconds:=60000
  ) into v_id;
  return v_id;
end $$;
revoke all on function public.observatorio_google_fila_disparar() from public,anon,authenticated,service_role;

-- Mesmo nome reaproveita o job; não altera os jobs diários de coleta.
select cron.schedule('observatorio-radar-links','* * * * *','select public.observatorio_google_fila_disparar();');
commit;
