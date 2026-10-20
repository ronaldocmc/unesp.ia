-- Ative antes da função observatorio-conversa. Não armazena perguntas ou respostas.
begin;
create schema if not exists private;
create table if not exists private.observatorio_conversa_uso (
  dia date not null, chave text not null, chamadas integer not null default 0,
  ultima_em timestamptz, primary key(dia,chave)
);
alter table private.observatorio_conversa_uso enable row level security;
revoke all on private.observatorio_conversa_uso from public, anon, authenticated, service_role;
create or replace function public.observatorio_conversa_reservar()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_dia date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_global private.observatorio_conversa_uso%rowtype;
  v_local private.observatorio_conversa_uso%rowtype;
begin
  if v_user is null then raise exception 'Login necessário'; end if;
  insert into private.observatorio_conversa_uso(dia,chave) values(v_dia,'global') on conflict do nothing;
  select * into v_global from private.observatorio_conversa_uso where dia=v_dia and chave='global' for update;
  insert into private.observatorio_conversa_uso(dia,chave) values(v_dia,v_user::text) on conflict do nothing;
  select * into v_local from private.observatorio_conversa_uso where dia=v_dia and chave=v_user::text for update;
  v_now := clock_timestamp();
  if v_global.chamadas >= 50 then return jsonb_build_object('ok',false,'motivo','limite_diario_global'); end if;
  if v_local.chamadas >= 10 then return jsonb_build_object('ok',false,'motivo','limite_diario_usuario'); end if;
  if v_local.ultima_em > v_now - interval '15 seconds' then return jsonb_build_object('ok',false,'motivo','intervalo_15_segundos'); end if;
  update private.observatorio_conversa_uso set chamadas=chamadas+1,ultima_em=v_now where dia=v_dia and chave in ('global',v_user::text);
  return jsonb_build_object('ok',true,'restantes_usuario',9-v_local.chamadas);
end $$;
revoke all on function public.observatorio_conversa_reservar() from public,anon;
grant execute on function public.observatorio_conversa_reservar() to authenticated;
notify pgrst, 'reload schema';
commit;
