-- Aplicar após radar_worker_monitor. Não reativa falhas históricas automaticamente.
begin;
create table if not exists private.radar_reprocessamentos (
  id bigint generated always as identity primary key,
  google_key text not null, solicitado_em timestamptz not null default clock_timestamp(),
  solicitado_por uuid not null, tentativas_anteriores integer not null, motivo_anterior text
);
alter table private.radar_reprocessamentos enable row level security;
revoke all on private.radar_reprocessamentos from public,anon,authenticated,service_role;
revoke all on sequence private.radar_reprocessamentos_id_seq from public,anon,authenticated,service_role;

-- Motivos vêm dos resolvedores existentes. Desconhecidos não geram repetição cega.
create or replace function private.radar_retry_politica(p_motivo text,p_tentativas integer)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_m text:=lower(coalesce(p_motivo,'')); v_classe text; v_base integer;
begin
  if v_m ~ '(título|titulo).*(ausente|insuficiente)' or v_m ~ 'data de publica.*(ausente|confirmada)'
    or v_m ~ 'veículo e domínio ausentes' then v_classe:='dados_ausentes';
  elsif v_m ~ '(revisão necessária|revisao necessaria|não corresponde|nenhuma correspondência verificável)' then v_classe:='revisao_necessaria';
  elsif v_m ~ 'http[ :]+429([^0-9]|$)' then v_classe:='temporario_429'; v_base:=900;
  elsif v_m ~ 'http[ :]+(500|502|503|504|408)([^0-9]|$)' then v_classe:='temporario_servidor'; v_base:=300;
  elsif v_m ~ '(timeout|timed out|tempo limite|tempo esgotado|etimedout)' then v_classe:='timeout'; v_base:=120;
  elsif v_m ~ '(aguardando.*(intervalo|cota|pausa)|cota ou pausa|controle de acesso ao provedor indisponível)' then v_classe:='aguardar_provedor'; v_base:=300;
  elsif v_m ~ 'http[ :]+(401|403|404|410)([^0-9]|$)' then v_classe:='acesso_ou_url';
  else v_classe:='revisao_necessaria';
  end if;
  return jsonb_build_object('classe',v_classe,'automatico',v_base is not null,
    'espera_segundos',case when v_base is not null then least(21600,v_base*power(2,greatest(0,least(5,coalesce(p_tentativas,0))-1)))::integer end);
end $$;
revoke all on function private.radar_retry_politica(text,integer) from public,anon,authenticated,service_role;

-- Mantém leases, validação, telemetria, aplicação editorial e limite de cinco consultas.
create or replace function public.observatorio_google_fila_finalizar_v1(p_chave text,p_token uuid,p_url text default null,
  p_consultou boolean default true,p_retomar timestamptz default null,p_motivo text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job private.radar_google_fila%rowtype; v_count integer; v_state text; v_next timestamptz; v_apply jsonb; v_policy jsonb;
begin
  select * into v_job from private.radar_google_fila where google_key=p_chave for update;
  if not found or p_token is null or v_job.token is distinct from p_token or v_job.estado<>'processando' then return jsonb_build_object('ok',false); end if;
  v_count:=greatest(0,v_job.tentativas-case when p_consultou is false then 1 else 0 end);
  if p_url is not null then
    v_apply:=private.radar_google_aplicar(p_chave,p_url);
    insert into private.radar_google_links(google_key,url_original) values(p_chave,p_url)
      on conflict(google_key) do update set url_original=excluded.url_original,atualizado_em=clock_timestamp(),expira_em=clock_timestamp()+interval '30 days';
    v_state:='resolvido';
    v_next:=greatest(clock_timestamp()+interval '1 minute',p_retomar);
  else
    v_policy:=private.radar_retry_politica(p_motivo,v_count);
    v_state:=case when v_count>=5 or not (v_policy->>'automatico')::boolean then 'falhou' else 'pendente' end;
    v_next:=greatest(clock_timestamp()+make_interval(secs=>coalesce((v_policy->>'espera_segundos')::integer,300)),p_retomar);
  end if;
  update private.radar_google_fila set estado=v_state,tentativas=v_count,url_original=p_url,
    token=null,reserva_ate=null,proxima_em=v_next,atualizado_em=clock_timestamp(),
    ultimo_motivo=case when p_url is null then left(p_motivo,300)
      when (v_apply->>'conflitos')::integer>0 then 'Endereço identificado; duplicidade ou descarte exige conferência.' end
    where google_key=p_chave;
  perform private.radar_worker_registrar(case when p_consultou is true then 'tentativa' else 'sem_consulta' end,v_state,case when p_url is null then p_motivo end);
  return jsonb_build_object('ok',true,'estado',v_state,'proxima_em',v_next,'tentativas',v_count,'aplicacao',v_apply,'politica',v_policy);
end $$;
revoke all on function public.observatorio_google_fila_finalizar_v1(text,uuid,text,boolean,timestamptz,text) from public,anon,authenticated;
grant execute on function public.observatorio_google_fila_finalizar_v1(text,uuid,text,boolean,timestamptz,text) to service_role;

-- Somente solicitação explícita da curadoria abre outro ciclo. Duas solicitações concorrentes não o reiniciam duas vezes.
create or replace function public.observatorio_resolucao_reprocessar(p_chave text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job private.radar_google_fila%rowtype; v_next timestamptz;
begin
  if auth.uid() is null or not coalesce(private.is_observatorio_admin() or private.is_observatorio_curador(),false)
    then raise exception 'Restrito à curadoria' using errcode='42501'; end if;
  if p_chave is null or length(p_chave)>2048 then raise exception 'Link inválido'; end if;
  select * into v_job from private.radar_google_fila where google_key=p_chave for update;
  if not found or v_job.estado<>'falhou' then return jsonb_build_object('ok',false,'motivo','O item não está mais em falha. Atualize a lista.'); end if;
  insert into private.radar_reprocessamentos(google_key,solicitado_por,tentativas_anteriores,motivo_anterior)
    values(p_chave,auth.uid(),v_job.tentativas,v_job.ultimo_motivo);
  v_next:=greatest(clock_timestamp(),v_job.proxima_em);
  update private.radar_google_fila set estado='pendente',tentativas=0,proxima_em=v_next,
    token=null,reserva_ate=null,ultimo_motivo='Reprocessamento manual solicitado; aguardando elegibilidade.',atualizado_em=clock_timestamp()
    where google_key=p_chave;
  return jsonb_build_object('ok',true,'estado','pendente','proxima_em',v_next);
end $$;
revoke all on function public.observatorio_resolucao_reprocessar(text) from public,anon;
grant execute on function public.observatorio_resolucao_reprocessar(text) to authenticated;
notify pgrst,'reload schema';
commit;
