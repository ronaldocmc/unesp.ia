-- Execute no SQL Editor antes de implantar a nova observatorio-radar.
-- Cache e proteção compartilhados; não altera publicações, fontes nem agendamentos.
begin;
create schema if not exists private;

create table if not exists private.radar_google_links (
  google_key text primary key,
  url_original text not null,
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '30 days'),
  check (length(google_key) <= 2048 and google_key ~ '^https://news[.]google[.]com/articles/[A-Za-z0-9_-]+$'),
  check (length(url_original) <= 2048 and url_original ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^[:space:]]+')
);
create table if not exists private.radar_google_estado (
  chave text primary key check (chave = 'google_news'),
  pausado_ate timestamptz,
  proxima_consulta_em timestamptz not null default '-infinity',
  lease_token uuid,
  lease_chave text,
  lease_ate timestamptz
);
alter table private.radar_google_links enable row level security;
alter table private.radar_google_estado enable row level security;
revoke all on private.radar_google_links, private.radar_google_estado from public, anon, authenticated, service_role;

create or replace function public.observatorio_google_link_iniciar(p_chave text, p_somente_cache boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_estado private.radar_google_estado%rowtype;
  v_now timestamptz;
  v_token uuid;
  v_retomar timestamptz;
begin
  if p_chave is null or length(p_chave) > 2048 or p_chave !~ '^https://news[.]google[.]com/articles/[A-Za-z0-9_-]+$' then
    raise exception 'Chave Google inválida';
  end if;
  select url_original into v_url from private.radar_google_links
    where google_key = p_chave and expira_em > clock_timestamp();
  -- Cache permanece disponível durante bloqueios, inclusive em outras execuções.
  if v_url is not null then return jsonb_build_object('situacao','cache','url',v_url); end if;
  if p_somente_cache is true then return jsonb_build_object('situacao','pendente'); end if;

  insert into private.radar_google_estado(chave) values('google_news') on conflict do nothing;
  select * into v_estado from private.radar_google_estado where chave = 'google_news' for update;
  v_now := clock_timestamp();
  if v_estado.pausado_ate > v_now then
    return jsonb_build_object('situacao','pausa','retomar_em',v_estado.pausado_ate);
  end if;
  v_retomar := greatest(v_estado.proxima_consulta_em, coalesce(v_estado.lease_ate, '-infinity'::timestamptz));
  if v_retomar > v_now then return jsonb_build_object('situacao','aguardar','retomar_em',v_retomar); end if;
  v_token := gen_random_uuid();
  update private.radar_google_estado set lease_token = v_token, lease_chave = p_chave,
    lease_ate = v_now + interval '45 seconds', proxima_consulta_em = v_now + interval '5 seconds'
    where chave = 'google_news';
  return jsonb_build_object('situacao','consultar','token',v_token);
end $$;

create or replace function public.observatorio_google_link_finalizar(
  p_chave text, p_token uuid, p_url text default null, p_espera_segundos integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_estado private.radar_google_estado%rowtype;
  v_now timestamptz;
  v_retomar timestamptz;
begin
  select * into v_estado from private.radar_google_estado where chave = 'google_news' for update;
  if p_token is null or v_estado.lease_token is distinct from p_token or v_estado.lease_chave is distinct from p_chave then
    return jsonb_build_object('ok',false);
  end if;
  v_now := clock_timestamp();
  if p_espera_segundos is not null and p_espera_segundos < 1 then raise exception 'Pausa inválida'; end if;
  if p_url is not null and (length(p_url) > 2048
    or p_url !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^[:space:]]+'
    or p_url ~ '^https://([A-Za-z0-9-]+\.)*google\.[^/]+/') then raise exception 'Destino original inválido'; end if;
  if p_espera_segundos is not null then
    v_retomar := greatest(v_estado.pausado_ate, v_now + p_espera_segundos * interval '1 second');
  end if;
  if p_url is not null and p_espera_segundos is null then
    insert into private.radar_google_links(google_key,url_original,atualizado_em,expira_em)
      values(p_chave,p_url,v_now,v_now + interval '30 days')
      on conflict(google_key) do update set url_original = excluded.url_original,
        atualizado_em = excluded.atualizado_em, expira_em = excluded.expira_em;
  end if;
  update private.radar_google_estado set lease_token = null, lease_chave = null, lease_ate = null,
    pausado_ate = coalesce(v_retomar, pausado_ate), proxima_consulta_em = v_now + interval '5 seconds'
    where chave = 'google_news';
  return jsonb_build_object('ok',true,'retomar_em',v_retomar);
end $$;

revoke all on function public.observatorio_google_link_iniciar(text,boolean) from public, anon, authenticated;
revoke all on function public.observatorio_google_link_finalizar(text,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.observatorio_google_link_iniciar(text,boolean) to service_role;
grant execute on function public.observatorio_google_link_finalizar(text,uuid,text,integer) to service_role;
notify pgrst, 'reload schema';
commit;
