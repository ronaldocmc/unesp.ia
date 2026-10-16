-- Execute antes de atualizar a função e o painel de prévia/curadoria.
begin;
create table if not exists public.observatorio_radar_descartes (
  url_key text primary key,
  url text not null,
  titulo text not null,
  fonte text,
  motivo text,
  descartado_por uuid references auth.users(id) on delete set null,
  descartado_em timestamptz not null default now(),
  ativo boolean not null default true
);
alter table public.observatorio_radar_descartes enable row level security;
revoke all on public.observatorio_radar_descartes from public, anon, authenticated;
grant select on public.observatorio_radar_descartes to authenticated, service_role;
grant update (ativo) on public.observatorio_radar_descartes to authenticated;
drop policy if exists radar_descartes_ler on public.observatorio_radar_descartes;
create policy radar_descartes_ler on public.observatorio_radar_descartes for select to authenticated
using ((select private.is_observatorio_admin()) or (select private.is_observatorio_curador()));
drop policy if exists radar_descartes_admin on public.observatorio_radar_descartes;
create policy radar_descartes_admin on public.observatorio_radar_descartes for update to authenticated
using ((select private.is_observatorio_admin())) with check ((select private.is_observatorio_admin()));

alter table public.observatorio_conteudos
  add column if not exists curadoria_por uuid references auth.users(id) on delete set null,
  add column if not exists curadoria_em timestamptz;

create or replace function private.radar_url_key(p_url text)
returns text language sql immutable set search_path = '' as $$
  select lower(btrim(split_part(p_url, '#', 1)));
$$;
revoke all on function private.radar_url_key(text) from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function private.radar_url_key(text) to authenticated, service_role;
create index if not exists observatorio_radar_url_key_idx on public.observatorio_conteudos(private.radar_url_key(url));

-- Serializa as decisões e as inserções do Radar por link. Não afeta updates do editor.
-- Impede que uma agenda reinclua um descarte ou duplique um link salvo em paralelo.
create or replace function private.radar_guardar_insercao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_key text;
begin
  if new.agente_origem in ('radar','radar_gemini') then
    v_key := private.radar_url_key(new.url);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));
    if exists(select 1 from public.observatorio_radar_descartes where url_key = v_key and ativo)
      or exists(select 1 from public.observatorio_conteudos where private.radar_url_key(url) = v_key) then
      return null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.radar_guardar_insercao() from public, anon, authenticated;
drop trigger if exists radar_guardar_insercao on public.observatorio_conteudos;
create trigger radar_guardar_insercao before insert on public.observatorio_conteudos
for each row execute function private.radar_guardar_insercao();

create or replace function public.observatorio_radar_decidir(
  p_acao text, p_conteudo jsonb, p_confirmacao boolean default false, p_motivo text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_url text := btrim(p_conteudo->>'url');
  v_key text;
  v_titulo text := btrim(p_conteudo->>'titulo');
  v_resumo text := btrim(p_conteudo->>'resumo');
  v_fonte text := btrim(p_conteudo->>'fonte');
  v_categoria text := p_conteudo->>'categoria';
  v_tipo text;
  v_data date;
  v_relevancia integer;
  v_id bigint;
  v_existing public.observatorio_conteudos%rowtype;
begin
  if v_user is null or not (private.is_observatorio_admin() or private.is_observatorio_curador()) then
    raise exception 'Ação exclusiva da curadoria autenticada.' using errcode = '42501';
  end if;
  if p_acao is null or p_acao not in ('revisao','publicar','descartar') then
    raise exception 'Escolha salvar para revisão, publicar ou descartar.';
  end if;
  if jsonb_typeof(p_conteudo) is distinct from 'object' or octet_length(p_conteudo::text) > 12000 then
    raise exception 'Conteúdo inválido ou muito grande.';
  end if;
  -- Apenas links HTTPS; não há download nesta RPC. Campos extras do cliente são ignorados.
  if v_url is null or length(v_url) > 2048 or v_url !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^[:space:]]*)?$' then
    raise exception 'Informe um link HTTPS público válido, sem credenciais ou porta personalizada.';
  end if;
  if v_titulo is null or length(v_titulo) not between 1 and 300 then raise exception 'Informe um título com até 300 caracteres.'; end if;
  if length(coalesce(v_fonte,'')) > 200 then raise exception 'Fonte muito longa (máximo 200 caracteres).'; end if;
  v_key := private.radar_url_key(v_url);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));
  select * into v_existing from public.observatorio_conteudos
    where private.radar_url_key(url) = v_key order by id limit 1;
  if found then
    return jsonb_build_object('situacao','ja_cadastrado','item',jsonb_build_object(
      'id',v_existing.id,'titulo',v_existing.titulo,'url',v_existing.url,'fonte',v_existing.fonte));
  end if;
  if p_acao = 'descartar' then
    insert into public.observatorio_radar_descartes(url_key,url,titulo,fonte,motivo,descartado_por)
    values(v_key,v_url,v_titulo,v_fonte,left(p_motivo,500),v_user)
    on conflict(url_key) do update set url = excluded.url, titulo = excluded.titulo,
      fonte = excluded.fonte, motivo = excluded.motivo, descartado_por = v_user, descartado_em = now(), ativo = true;
    return jsonb_build_object('situacao','descartado');
  end if;
  if exists(select 1 from public.observatorio_radar_descartes where url_key = v_key and ativo) then
    raise exception 'Este link foi descartado. Peça à administração para reativá-lo antes de salvar.';
  end if;
  if v_resumo is null or length(v_resumo) not between 1 and 1200 then raise exception 'Revise o resumo (1 a 1200 caracteres).'; end if;
  if v_fonte is null or v_fonte = '' then raise exception 'Informe a fonte.'; end if;
  if v_categoria is null or v_categoria not in ('pesquisa','noticia','aplicacao','regulacao') then raise exception 'Categoria inválida.'; end if;
  if coalesce(p_conteudo->>'data_publicacao','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Revise a data de publicação.'; end if;
  v_data := (p_conteudo->>'data_publicacao')::date;
  if p_acao = 'publicar' and p_confirmacao is distinct from true then
    raise exception 'Confirme explicitamente a revisão humana antes de publicar.';
  end if;
  if p_conteudo->>'relevancia_ia' is not null then
    v_relevancia := (p_conteudo->>'relevancia_ia')::integer;
    if v_relevancia not between 0 and 100 then raise exception 'Relevância inválida.'; end if;
  end if;
  v_tipo := case v_categoria when 'pesquisa' then 'Pesquisa' when 'aplicacao' then 'Tecnologia'
    when 'regulacao' then 'Regulação' else 'Notícia monitorada' end;
  insert into public.observatorio_conteudos
    (colecao,tipo,categoria,titulo,resumo,data_publicacao,url,fonte,origem,agente_origem,
     agente_processado_em,status,destaque,revisao_humana,aprovado_curadoria,relevancia_ia,
     observacao_colaborador,submetido_por,curadoria_por,curadoria_em)
  values('Observatório',v_tipo,v_categoria,v_titulo,v_resumo,v_data,v_url,v_fonte,'Agente Radar',
    case when p_conteudo->>'agente_origem' = 'radar_gemini' then 'radar_gemini' else 'radar' end,
    now(),case when p_acao = 'publicar' then 'publicado' else 'revisao' end,false,
    p_acao = 'publicar',p_acao = 'publicar',v_relevancia,left(p_conteudo->>'observacao_colaborador',2000),
    v_user,
    case when p_acao = 'publicar' then v_user end,case when p_acao = 'publicar' then now() end)
  returning id into v_id;
  if v_id is null then raise exception 'O conteúdo mudou durante a decisão. Atualize o Radar.'; end if;
  return jsonb_build_object('situacao',case when p_acao = 'publicar' then 'publicado' else 'revisao' end,
    'item',jsonb_build_object('id',v_id,'titulo',v_titulo,'url',v_url,'fonte',v_fonte));
end;
$$;
revoke all on function public.observatorio_radar_decidir(text,jsonb,boolean,text) from public, anon;
grant execute on function public.observatorio_radar_decidir(text,jsonb,boolean,text) to authenticated;
notify pgrst, 'reload schema';
commit;
