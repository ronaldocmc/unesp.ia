-- Telemetria independente de HTTP 200, sem tokens/segredos e sem alterar cotas.
begin;
create table if not exists private.radar_worker_eventos (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default clock_timestamp(),
  evento text not null check(evento in ('execucao','tentativa','sem_consulta','resolvido')),
  situacao text, motivo text
);
create index if not exists radar_worker_eventos_data on private.radar_worker_eventos(criado_em desc);
alter table private.radar_worker_eventos enable row level security;
revoke all on private.radar_worker_eventos from public,anon,authenticated,service_role;
revoke all on sequence private.radar_worker_eventos_id_seq from public,anon,authenticated,service_role;

create or replace function private.radar_worker_registrar(p_evento text,p_situacao text,p_motivo text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into private.radar_worker_eventos(evento,situacao,motivo) values(p_evento,left(p_situacao,40),left(p_motivo,300));
  delete from private.radar_worker_eventos where criado_em<clock_timestamp()-interval '30 days';
end $$;
revoke all on function private.radar_worker_registrar(text,text,text) from public,anon,authenticated,service_role;
create or replace function private.radar_worker_execucao(p_resultado jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.radar_worker_registrar('execucao',p_resultado->>'situacao');
  return p_resultado;
end $$;
revoke all on function private.radar_worker_execucao(jsonb) from public,anon,authenticated,service_role;

-- Mesmo contrato e algoritmo da reserva anterior; apenas registra quando o worker chegou ao banco.
create or replace function public.observatorio_google_fila_reservar()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_now timestamptz; v_next timestamptz; v_job private.radar_google_fila%rowtype; v_token uuid;
begin
  select proxima_em into v_next from private.radar_google_fila_controle where id=true for update;
  v_now:=clock_timestamp();
  if v_next>v_now then return private.radar_worker_execucao(jsonb_build_object('situacao','aguardar','retomar_em',v_next)); end if;
  if exists(select 1 from private.radar_google_fila where estado='processando' and reserva_ate>v_now) then return private.radar_worker_execucao(jsonb_build_object('situacao','ocupado')); end if;
  update private.radar_google_fila set estado='falhou',token=null,reserva_ate=null where estado='processando' and reserva_ate<=v_now and tentativas>=5;
  select * into v_job from private.radar_google_fila where tentativas<5 and
    ((estado='pendente' and proxima_em<=v_now) or (estado='processando' and reserva_ate<=v_now))
    order by proxima_em,criado_em for update skip locked limit 1;
  if not found then return private.radar_worker_execucao(jsonb_build_object('situacao','vazia')); end if;
  v_token:=gen_random_uuid();
  update private.radar_google_fila set estado='processando',tentativas=tentativas+1,token=v_token,
    reserva_ate=v_now+interval '2 minutes',atualizado_em=v_now where google_key=v_job.google_key;
  update private.radar_google_fila_controle set proxima_em=v_now+interval '1 minute' where id=true;
  return private.radar_worker_execucao(jsonb_build_object('situacao','processar','chave',v_job.google_key,'token',v_token,'url_original',v_job.url_original));
end $$;
revoke all on function public.observatorio_google_fila_reservar() from public,anon,authenticated;
grant execute on function public.observatorio_google_fila_reservar() to service_role;

-- Finalização compartilhada pelos fluxos antigo e inteligente; consulta=false não é tentativa.
create or replace function public.observatorio_google_fila_finalizar_v1(p_chave text,p_token uuid,p_url text default null,
  p_consultou boolean default true,p_retomar timestamptz default null,p_motivo text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job private.radar_google_fila%rowtype; v_count integer; v_state text; v_next timestamptz; v_apply jsonb;
begin
  select * into v_job from private.radar_google_fila where google_key=p_chave for update;
  if not found or p_token is null or v_job.token is distinct from p_token or v_job.estado<>'processando' then return jsonb_build_object('ok',false); end if;
  v_count:=greatest(0,v_job.tentativas-case when p_consultou is false then 1 else 0 end);
  if p_url is not null then
    v_apply:=private.radar_google_aplicar(p_chave,p_url);
    insert into private.radar_google_links(google_key,url_original) values(p_chave,p_url)
      on conflict(google_key) do update set url_original=excluded.url_original,atualizado_em=clock_timestamp(),expira_em=clock_timestamp()+interval '30 days';
    v_state:='resolvido';
  else v_state:=case when v_count>=5 then 'falhou' else 'pendente' end;
  end if;
  v_next:=greatest(clock_timestamp()+make_interval(secs=>least(3600,60*power(2,greatest(0,v_count-1)))::integer),p_retomar);
  update private.radar_google_fila set estado=v_state,tentativas=v_count,url_original=p_url,
    token=null,reserva_ate=null,proxima_em=v_next,atualizado_em=clock_timestamp(),
    ultimo_motivo=case when p_url is null then left(p_motivo,300)
      when (v_apply->>'conflitos')::integer>0 then 'Endereço identificado; duplicidade ou descarte exige conferência.' end
    where google_key=p_chave;
  perform private.radar_worker_registrar(case when p_consultou is true then 'tentativa' else 'sem_consulta' end,v_state,case when p_url is null then p_motivo end);
  return jsonb_build_object('ok',true,'estado',v_state,'proxima_em',v_next,'tentativas',v_count,'aplicacao',v_apply);
end $$;
revoke all on function public.observatorio_google_fila_finalizar_v1(text,uuid,text,boolean,timestamptz,text) from public,anon,authenticated;
grant execute on function public.observatorio_google_fila_finalizar_v1(text,uuid,text,boolean,timestamptz,text) to service_role;

-- Captura inclusive resoluções via cache, mas não simples atualizações de um item já resolvido.
create or replace function private.radar_worker_resolvido()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.estado='resolvido' then
    if tg_op='INSERT' then perform private.radar_worker_registrar('resolvido','resolvido');
    elsif old.estado is distinct from 'resolvido' then perform private.radar_worker_registrar('resolvido','resolvido'); end if;
  end if;
  return new;
end $$;
revoke all on function private.radar_worker_resolvido() from public,anon,authenticated,service_role;
drop trigger if exists radar_worker_resolvido on private.radar_google_fila;
create trigger radar_worker_resolvido after insert or update of estado on private.radar_google_fila
for each row execute function private.radar_worker_resolvido();

create or replace function public.observatorio_worker_situacao()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_inicio timestamptz := date_trunc('day',clock_timestamp() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if not coalesce(private.is_observatorio_admin(),false) then raise exception 'Acesso restrito à administração.' using errcode='42501'; end if;
  return jsonb_build_object(
    'ultima_execucao',(select max(criado_em) from private.radar_worker_eventos where evento='execucao'),
    'ultimo_estado',(select situacao from private.radar_worker_eventos where evento='execucao' order by id desc limit 1),
    'ultima_tentativa',(select max(criado_em) from private.radar_worker_eventos where evento='tentativa'),
    'ultima_resolucao',(select max(criado_em) from private.radar_worker_eventos where evento='resolvido'),
    'ultimo_resultado',(select jsonb_build_object('situacao',situacao,'motivo',motivo,'data',criado_em) from private.radar_worker_eventos where evento in ('tentativa','sem_consulta') order by id desc limit 1),
    'execucoes_hoje',(select count(*) from private.radar_worker_eventos where evento='execucao' and criado_em>=v_inicio),
    'tentativas_hoje',(select count(*) from private.radar_worker_eventos where evento='tentativa' and criado_em>=v_inicio),
    'sem_consulta_hoje',(select count(*) from private.radar_worker_eventos where evento='sem_consulta' and criado_em>=v_inicio),
    'resolvidos_hoje',(select count(*) from private.radar_worker_eventos where evento='resolvido' and criado_em>=v_inicio),
    'em_processamento',(select count(*) from private.radar_google_fila where estado='processando' and reserva_ate>clock_timestamp()),
    'pendentes',(select count(*) from private.radar_google_fila where estado='pendente'),
    'proxima_elegivel',(select min(proxima_em) from private.radar_google_fila where estado='pendente' and tentativas<5),
    'consultado_em',clock_timestamp()
  );
end $$;
revoke all on function public.observatorio_worker_situacao() from public,anon;
grant execute on function public.observatorio_worker_situacao() to authenticated;
notify pgrst,'reload schema';
commit;
