-- Requer radar_google_cache e radar_curadoria. Não cria agendamento nem publica conteúdo.
begin;
create table if not exists private.radar_google_fila (
  google_key text primary key, estado text not null default 'pendente'
    check (estado in ('pendente','processando','resolvido','falhou')),
  tentativas integer not null default 0 check (tentativas between 0 and 5),
  proxima_em timestamptz not null default now(), criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(), token uuid, reserva_ate timestamptz,
  url_original text, ultimo_motivo text,
  check (length(google_key) <= 2048 and google_key ~ '^https://news[.]google[.]com/articles/[A-Za-z0-9_-]+$')
);
create index if not exists radar_google_fila_pendentes on private.radar_google_fila(proxima_em)
  where estado in ('pendente','processando');
create table if not exists private.radar_google_fila_controle (
  id boolean primary key default true check(id), proxima_em timestamptz not null default '-infinity'
);
insert into private.radar_google_fila_controle(id) values(true) on conflict do nothing;
alter table private.radar_google_fila enable row level security;
alter table private.radar_google_fila_controle enable row level security;
revoke all on private.radar_google_fila, private.radar_google_fila_controle from public,anon,authenticated,service_role;

create or replace function private.radar_google_chave(p_url text)
returns text language sql immutable set search_path='' as $$
  select case when length(p_url)<=2048 then 'https://news.google.com/articles/' ||
    (regexp_match(p_url,'^https://news[.]google[.]com/(rss/)?(articles|read)/([A-Za-z0-9_-]+)([?#][^[:space:]]*)?$'))[3] end;
$$;
revoke all on function private.radar_google_chave(text) from public,anon,authenticated,service_role;

-- Apenas o link de itens ainda não revisados; nunca altera status, título, data ou aprovação.
create or replace function private.radar_google_aplicar(p_chave text,p_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item record; v_alterados integer:=0; v_conflitos integer:=0;
begin
  if p_url is null or length(p_url)>2048 or p_url !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^[:space:]]+'
    or p_url ~ '^https://([A-Za-z0-9-]+\.)*google\.[^/]+/' then raise exception 'Destino inválido'; end if;
  -- Mesmo lock usado pelas inserções/decisões do Radar: não duplica o destino.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(private.radar_url_key(p_url),0));
  for v_item in select id,url from public.observatorio_conteudos
    where private.radar_google_chave(url)=p_chave and agente_origem in ('radar','radar_gemini')
      and status='revisao' and revisao_humana=false and aprovado_curadoria=false
      and curadoria_por is null and curadoria_em is null order by id for update
  loop
    if exists(select 1 from public.observatorio_conteudos where id<>v_item.id and private.radar_url_key(url)=private.radar_url_key(p_url))
      or exists(select 1 from public.observatorio_radar_descartes where ativo
        and url_key in (private.radar_url_key(p_url),private.radar_url_key(v_item.url))) then
      v_conflitos:=v_conflitos+1;
    else
      update public.observatorio_conteudos set url=p_url,
        observacao_colaborador=case when observacao_colaborador like 'Link do Google Notícias%' then null else observacao_colaborador end
      where id=v_item.id and url=v_item.url and status='revisao' and revisao_humana=false
        and aprovado_curadoria=false and curadoria_por is null and curadoria_em is null;
      if found then v_alterados:=v_alterados+1; end if;
    end if;
  end loop;
  return jsonb_build_object('atualizados',v_alterados,'conflitos',v_conflitos);
end $$;
revoke all on function private.radar_google_aplicar(text,text) from public,anon,authenticated,service_role;

-- Prévias cadastram somente URLs na fila, nunca novos conteúdos no acervo.
create or replace function public.observatorio_google_fila_adicionar(p_urls text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_url text; v_chave text; v_destino text; v_itens jsonb:='[]'::jsonb; v_job private.radar_google_fila%rowtype;
begin
  if p_urls is null or cardinality(p_urls)>300 then raise exception 'Lote inválido (máximo 300 links)'; end if;
  for v_url in select distinct unnest(p_urls) order by 1 loop
    v_chave:=private.radar_google_chave(v_url);
    if v_chave is null then raise exception 'Link Google inválido'; end if;
    insert into private.radar_google_fila(google_key) values(v_chave) on conflict do nothing;
    select * into v_job from private.radar_google_fila where google_key=v_chave for update;
    select url_original into v_destino from private.radar_google_links where google_key=v_chave and expira_em>clock_timestamp();
    v_destino:=coalesce(v_destino,v_job.url_original);
    if v_destino is not null then
      -- O vínculo ID/destino já identificado é durável; o cache rápido tem TTL de 30 dias.
      insert into private.radar_google_links(google_key,url_original) values(v_chave,v_destino)
        on conflict(google_key) do update set url_original=excluded.url_original,expira_em=clock_timestamp()+interval '30 days',atualizado_em=clock_timestamp();
      update private.radar_google_fila set estado='resolvido',url_original=v_destino,token=null,reserva_ate=null,
        atualizado_em=clock_timestamp(),ultimo_motivo=null where google_key=v_chave;
      perform private.radar_google_aplicar(v_chave,v_destino);
    end if;
    select * into v_job from private.radar_google_fila where google_key=v_chave;
    v_itens:=v_itens||jsonb_build_array(jsonb_build_object('chave',v_chave,'estado',v_job.estado,
      'url',v_job.url_original,'tentativas',v_job.tentativas,'proxima_em',v_job.proxima_em));
  end loop;
  return jsonb_build_object('ok',true,'itens',v_itens);
end $$;
revoke all on function public.observatorio_google_fila_adicionar(text[]) from public,anon,authenticated;
grant execute on function public.observatorio_google_fila_adicionar(text[]) to service_role;

create or replace function public.observatorio_google_fila_reservar()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_retomar timestamptz; v_job private.radar_google_fila%rowtype; v_token uuid;
begin
  perform 1 from private.radar_google_fila_controle where id=true for update;
  v_now:=clock_timestamp();
  select greatest(pausado_ate,proxima_consulta_em,lease_ate) into v_retomar from private.radar_google_estado where chave='google_news';
  if v_retomar>v_now then return jsonb_build_object('situacao','aguardar','retomar_em',v_retomar); end if;
  select proxima_em into v_retomar from private.radar_google_fila_controle where id=true;
  if v_retomar>v_now then return jsonb_build_object('situacao','aguardar','retomar_em',v_retomar); end if;
  if exists(select 1 from private.radar_google_fila where estado='processando' and reserva_ate>v_now) then
    return jsonb_build_object('situacao','ocupado'); end if;
  -- Uma execução interrompida também consome tentativa; não há repetição infinita.
  update private.radar_google_fila set estado='falhou',token=null,reserva_ate=null,ultimo_motivo='Execução interrompida; limite de tentativas atingido.'
    where estado='processando' and reserva_ate<=v_now and tentativas>=5;
  select * into v_job from private.radar_google_fila where tentativas<5
    and ((estado='pendente' and proxima_em<=v_now) or (estado='processando' and reserva_ate<=v_now))
    order by proxima_em,criado_em for update skip locked limit 1;
  if not found then return jsonb_build_object('situacao','vazia'); end if;
  v_token:=gen_random_uuid();
  update private.radar_google_fila set estado='processando',tentativas=tentativas+1,token=v_token,
    reserva_ate=v_now+interval '2 minutes',atualizado_em=v_now where google_key=v_job.google_key;
  update private.radar_google_fila_controle set proxima_em=v_now+interval '1 minute' where id=true;
  return jsonb_build_object('situacao','processar','chave',v_job.google_key,'token',v_token,'url_original',v_job.url_original);
end $$;
revoke all on function public.observatorio_google_fila_reservar() from public,anon,authenticated;
grant execute on function public.observatorio_google_fila_reservar() to service_role;

create or replace function public.observatorio_google_fila_finalizar(p_chave text,p_token uuid,p_url text default null,
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
  return jsonb_build_object('ok',true,'estado',v_state,'proxima_em',v_next,'tentativas',v_count,'aplicacao',v_apply);
end $$;
revoke all on function public.observatorio_google_fila_finalizar(text,uuid,text,boolean,timestamptz,text) from public,anon,authenticated;
grant execute on function public.observatorio_google_fila_finalizar(text,uuid,text,boolean,timestamptz,text) to service_role;

create or replace function private.radar_google_enfileirar_conteudo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if private.radar_google_chave(new.url) is not null and new.agente_origem in ('radar','radar_gemini')
    and new.status='revisao' and new.revisao_humana=false and new.aprovado_curadoria=false
    and new.curadoria_por is null and new.curadoria_em is null then
    -- Somente enfileira aqui. A atualização de URL fica para a execução fora do trigger.
    insert into private.radar_google_fila(google_key) values(private.radar_google_chave(new.url))
      on conflict(google_key) do update set estado='pendente',proxima_em=clock_timestamp(),tentativas=0
      where radar_google_fila.estado='resolvido';
  end if;
  return new;
end $$;
revoke all on function private.radar_google_enfileirar_conteudo() from public,anon,authenticated,service_role;
drop trigger if exists radar_google_enfileirar on public.observatorio_conteudos;
create trigger radar_google_enfileirar after insert or update of url on public.observatorio_conteudos
  for each row execute function private.radar_google_enfileirar_conteudo();
-- Recupera os pendentes antigos sem alterar seus conteúdos nem reiniciar tentativas.
insert into private.radar_google_fila(google_key)
  select distinct private.radar_google_chave(url) from public.observatorio_conteudos
  where private.radar_google_chave(url) is not null and agente_origem in ('radar','radar_gemini')
    and status='revisao' and revisao_humana=false and aprovado_curadoria=false and curadoria_por is null and curadoria_em is null
  on conflict do nothing;
notify pgrst,'reload schema';
commit;
