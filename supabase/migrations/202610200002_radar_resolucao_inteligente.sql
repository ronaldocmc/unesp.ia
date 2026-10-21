-- Estende a fila existente sem apagar estado, tentativas, notícias ou agendamentos.
begin;
alter table public.observatorio_feeds
  add column if not exists resolucao_oficial boolean not null default false,
  add column if not exists dominio_veiculo text,
  add column if not exists aliases_veiculo text;
alter table public.observatorio_conteudos
  add column if not exists url_rss text,
  add column if not exists url_original text,
  add column if not exists url_resolucao_metodo text,
  add column if not exists url_resolucao_status text,
  add column if not exists url_verificada_em timestamptz;
alter table private.radar_google_fila
  add column if not exists contexto jsonb not null default '{}'::jsonb,
  add column if not exists metodo text,
  add column if not exists verificado_em timestamptz,
  add column if not exists url_candidata text,
  add column if not exists candidata_metodo text,
  add column if not exists candidata_em timestamptz;
create table if not exists private.radar_url_observadas(
  url_rss text primary key check(length(url_rss)<=2048), google_key text,
  contexto jsonb not null default '{}'::jsonb, url_original text, metodo text,
  estado text not null default 'pendente', verificado_em timestamptz, expira_em timestamptz
);
create table if not exists private.radar_url_documentos(
  url text primary key, feed_id uuid not null references public.observatorio_feeds(id) on delete cascade,
  titulo text not null, veiculo text not null, data_publicacao date not null,
  verificado_em timestamptz not null default now(), expira_em timestamptz not null default now()+interval '1 day'
);
create table if not exists private.radar_url_origens(
  origem text primary key, dia date not null default current_date, quantidade integer not null default 0,
  proxima_em timestamptz not null default '-infinity', pausado_ate timestamptz,
  token uuid, reserva_ate timestamptz
);
create table if not exists private.radar_url_eventos(
  id bigint generated always as identity primary key, criado_em timestamptz not null default now(),
  metodo text not null, estado text not null, http_status integer, duracao_ms integer
);
create index if not exists radar_url_observadas_google on private.radar_url_observadas(google_key);
create index if not exists radar_url_observadas_original on private.radar_url_observadas(url_original) where url_original is not null;
create index if not exists radar_url_observadas_data on private.radar_url_observadas((contexto->>'data')) where estado='resolvido';
create index if not exists radar_url_documentos_feed on private.radar_url_documentos(feed_id,data_publicacao);
create index if not exists radar_url_eventos_data on private.radar_url_eventos(criado_em);
create index if not exists observatorio_resolucao_data on public.observatorio_conteudos(data_publicacao) where status='publicado' and revisao_humana;
alter table private.radar_url_observadas enable row level security;
alter table private.radar_url_documentos enable row level security;
alter table private.radar_url_origens enable row level security;
alter table private.radar_url_eventos enable row level security;
revoke all on private.radar_url_observadas,private.radar_url_documentos,private.radar_url_origens,private.radar_url_eventos from public,anon,authenticated,service_role;
revoke all on sequence private.radar_url_eventos_id_seq from public,anon,authenticated,service_role;

create or replace function public.observatorio_resolucao_registrar(p_itens jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item jsonb; v_rss text; v_key text; v_url text;
begin
  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)>300 or octet_length(p_itens::text)>1000000 then raise exception 'Lote de resolução inválido'; end if;
  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_rss:=v_item->>'url_rss'; v_key:=private.radar_google_chave(v_rss);
    if v_rss is null or length(v_rss)>2048 or v_rss !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^[:space:]]*' then continue; end if;
    v_url:=case when v_key is null then v_rss else v_item->>'url_original' end;
    if v_url is not null and (length(v_url)>2048 or v_url !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^[:space:]]+'
      or v_url ~ '^https://([A-Za-z0-9-]+\.)*google\.[^/]+/') then v_url:=null; end if;
    insert into private.radar_url_observadas(url_rss,google_key,contexto,url_original,metodo,estado,verificado_em,expira_em)
      values(v_rss,v_key,v_item,v_url,case when v_url is not null then case when v_key is null then 'direto' else 'cache' end end,
        case when v_url is not null then 'resolvido' else 'pendente' end,
        case when v_url is not null then clock_timestamp() end,clock_timestamp()+interval '30 days')
    on conflict(url_rss) do update set contexto=excluded.contexto,
      url_original=coalesce(excluded.url_original,private.radar_url_observadas.url_original),
      metodo=case when excluded.url_original is not null then excluded.metodo else private.radar_url_observadas.metodo end,
      estado=case when excluded.url_original is not null then 'resolvido' else private.radar_url_observadas.estado end,
      verificado_em=coalesce(excluded.verificado_em,private.radar_url_observadas.verificado_em);
    if v_key is not null then
      insert into private.radar_google_fila(google_key,contexto) values(v_key,v_item)
        on conflict(google_key) do update set contexto=excluded.contexto;
    end if;
  end loop;
  return jsonb_build_object('ok',true);
end $$;

-- Retorna apenas pistas necessárias ao resolvedor interno. Não retorna credenciais.
create or replace function public.observatorio_resolucao_contexto(p_chave text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_context jsonb; v_row record; v_cache text; v_feeds jsonb; v_candidate text; v_method text;
begin
  select contexto into v_context from private.radar_google_fila where google_key=p_chave;
  select url_candidata,candidata_metodo into v_candidate,v_method from private.radar_google_fila
    where google_key=p_chave and candidata_em>clock_timestamp()-interval '30 days';
  if coalesce(v_context->>'titulo','')='' then
    select titulo,fonte,data_publicacao into v_row from public.observatorio_conteudos
      where private.radar_google_chave(url)=p_chave order by id limit 1;
    if found then v_context:=jsonb_build_object('titulo',v_row.titulo,'veiculo',v_row.fonte,'data',v_row.data_publicacao,'data_confirmada',true,'url_rss',p_chave); end if;
  end if;
  select url_original into v_cache from private.radar_google_links where google_key=p_chave and expira_em>clock_timestamp();
  select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'instituicao',instituicao,'aliases',aliases_veiculo,
      'url',url_feed,'dominio',dominio_veiculo)) into v_feeds
    from public.observatorio_feeds where ativo and resolucao_oficial and dominio_veiculo is not null;
  return jsonb_build_object('ok',true,'contexto',coalesce(v_context,'{}'::jsonb),'cache',v_cache,
    'candidata',v_candidate,'candidata_metodo',v_method,'feeds',coalesce(v_feeds,'[]'::jsonb));
end $$;

-- Resultado de decoder ainda NÃO confirmado: nunca é aplicado ao conteúdo/cache final.
create or replace function public.observatorio_resolucao_candidata(p_chave text,p_url text,p_metodo text,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_metodo <> 'google_legado' or p_url is null or length(p_url)>2048
    or p_url !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^[:space:]]+'
    or p_url ~ '^https://([A-Za-z0-9-]+\.)*google\.[^/]+/' then raise exception 'Candidata inválida'; end if;
  update private.radar_google_fila set url_candidata=p_url,candidata_metodo=p_metodo,candidata_em=clock_timestamp()
    where google_key=p_chave and estado='processando' and token=p_token and reserva_ate>clock_timestamp();
  return jsonb_build_object('ok',found);
end $$;

create or replace function public.observatorio_resolucao_documentos(p_feed uuid,p_itens jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item jsonb; v_result jsonb; v_domain text; v_host text; v_date date;
begin
  select lower(dominio_veiculo) into v_domain from public.observatorio_feeds where id=p_feed and ativo and resolucao_oficial;
  if v_domain is null or v_domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then return jsonb_build_object('ok',false); end if;
  delete from private.radar_url_documentos where feed_id=p_feed and expira_em<=clock_timestamp();
  if p_itens is not null then
    if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)>100 or octet_length(p_itens::text)>200000 then raise exception 'Documentos inválidos'; end if;
    for v_item in select value from jsonb_array_elements(p_itens) loop
      if coalesce(v_item->>'data','')!~ '^\d{4}-\d{2}-\d{2}$' or length(coalesce(v_item->>'titulo','')) not between 1 and 300 then continue; end if;
      if length(coalesce(v_item->>'url','')) not between 1 and 2048
        or v_item->>'url' !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^[:space:]]+'
        or v_item->>'url' ~ '^https://([A-Za-z0-9-]+\.)*google\.[^/]+/' then continue; end if;
      v_host:=lower(split_part(split_part(v_item->>'url','://',2),'/',1));
      if v_host<>v_domain and right(v_host,length(v_domain)+1)<>'.'||v_domain then continue; end if;
      begin v_date:=(v_item->>'data')::date; exception when invalid_datetime_format or datetime_field_overflow then continue; end;
      insert into private.radar_url_documentos(url,feed_id,titulo,veiculo,data_publicacao)
        values(v_item->>'url',p_feed,v_item->>'titulo',left(coalesce(v_item->>'veiculo',''),200),v_date)
      on conflict(url) do update set feed_id=excluded.feed_id,titulo=excluded.titulo,veiculo=excluded.veiculo,data_publicacao=excluded.data_publicacao,
        verificado_em=clock_timestamp(),expira_em=clock_timestamp()+interval '1 day';
    end loop;
  end if;
  select jsonb_agg(jsonb_build_object('url',url,'titulo',titulo,'veiculo',veiculo,'data',data_publicacao,'verificado_em',verificado_em))
    into v_result from private.radar_url_documentos where feed_id=p_feed and expira_em>clock_timestamp();
  return jsonb_build_object('ok',true,'itens',coalesce(v_result,'[]'::jsonb));
end $$;

create or replace function public.observatorio_resolucao_existentes(p_data date,p_dominio text)
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('ok',true,'itens',coalesce(jsonb_agg(jsonb_build_object('url',url,'titulo',titulo,'data',dia,'veiculo',fonte)),'[]'::jsonb))
  from (select * from (
      select url,titulo,data_publicacao::text as dia,fonte from public.observatorio_conteudos
        where status='publicado' and revisao_humana and data_publicacao=p_data
      union all
      select url_original,contexto->>'titulo',contexto->>'data',contexto->>'veiculo'
        from private.radar_url_observadas where estado='resolvido' and url_original is not null
          and expira_em>clock_timestamp() and contexto->>'data'=p_data::text and contexto->>'data_confirmada'='true'
    ) conhecidos where (split_part(split_part(url,'://',2),'/',1)=p_dominio
      or right(split_part(split_part(url,'://',2),'/',1),length(p_dominio)+1)='.'||p_dominio)
    limit 100) x;
$$;

create or replace function public.observatorio_resolucao_origem_iniciar(p_origem text,p_intervalo integer default 60,p_limite integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row private.radar_url_origens%rowtype; v_now timestamptz:=clock_timestamp(); v_dia date:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date; v_token uuid; v_retry timestamptz;
begin
  if length(p_origem)>200 or p_origem !~ '^https://[a-z0-9.-]+$' or p_intervalo not between 1 and 86400 or p_limite not between 1 and 1000 then raise exception 'Limite/origem inválido'; end if;
  insert into private.radar_url_origens(origem) values(p_origem) on conflict do nothing;
  select * into v_row from private.radar_url_origens where origem=p_origem for update;
  v_now:=clock_timestamp();
  v_retry:=greatest(v_row.proxima_em,v_row.pausado_ate,v_row.reserva_ate);
  if p_origem='https://news.google.com' then
    select greatest(v_retry,pausado_ate,lease_ate) into v_retry from private.radar_google_estado where chave='google_news';
    -- Sem linha legada, preserva os limites desta origem.
    if not found then v_retry:=greatest(v_row.proxima_em,v_row.pausado_ate,v_row.reserva_ate); end if;
  end if;
  if v_retry>v_now then return jsonb_build_object('ok',false,'retomar_em',v_retry); end if;
  if v_row.dia=v_dia and v_row.quantidade>=p_limite then
    return jsonb_build_object('ok',false,'retomar_em',((v_dia+1)::timestamp at time zone 'America/Sao_Paulo')); end if;
  v_token:=gen_random_uuid();
  update private.radar_url_origens set token=v_token,reserva_ate=v_now+interval '1 minute',proxima_em=v_now+p_intervalo*interval '1 second',
    dia=v_dia,quantidade=case when dia=v_dia then quantidade+1 else 1 end where origem=p_origem;
  return jsonb_build_object('ok',true,'token',v_token);
end $$;
create or replace function public.observatorio_resolucao_origem_finalizar(p_origem text,p_token uuid,p_http integer default 200,p_espera integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  update private.radar_url_origens set token=null,reserva_ate=null,
    pausado_ate=case when p_http in (403,429,503) then greatest(pausado_ate,clock_timestamp()+greatest(60,coalesce(p_espera,900))*interval '1 second') else pausado_ate end
    where origem=p_origem and token=p_token and p_token is not null;
  if not found then return jsonb_build_object('ok',false); end if;
  if p_origem='https://news.google.com' and p_http in (403,429,503) then
    insert into private.radar_google_estado(chave,pausado_ate)
      select 'google_news',pausado_ate from private.radar_url_origens where origem=p_origem
      on conflict(chave) do update set pausado_ate=greatest(private.radar_google_estado.pausado_ate,excluded.pausado_ate);
  end if;
  return jsonb_build_object('ok',true);
end $$;

-- Acrescenta metadados sem mudar o contrato da finalização anterior.
do $$ begin
  if to_regprocedure('public.observatorio_google_fila_finalizar_v1(text,uuid,text,boolean,timestamptz,text)') is null then
    alter function public.observatorio_google_fila_finalizar(text,uuid,text,boolean,timestamptz,text) rename to observatorio_google_fila_finalizar_v1;
  end if;
end $$;
create or replace function public.observatorio_google_fila_finalizar(p_chave text,p_token uuid,p_url text default null,
  p_consultou boolean default true,p_retomar timestamptz default null,p_motivo text default null)
returns jsonb language sql security definer set search_path='' as $$
  select public.observatorio_google_fila_finalizar_v1(p_chave,p_token,p_url,p_consultou,p_retomar,p_motivo);
$$;
create or replace function public.observatorio_resolucao_finalizar(p_chave text,p_token uuid,p_url text,p_metodo text,
  p_consultou boolean,p_retomar timestamptz,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_context jsonb;
begin
  if p_metodo not in ('cache','banco','rss_oficial','busca','google_legado','pendente') then raise exception 'Método inválido'; end if;
  v_result:=public.observatorio_google_fila_finalizar_v1(p_chave,p_token,p_url,p_consultou,p_retomar,left(p_motivo,300));
  if (v_result->>'ok')::boolean is true then
    update private.radar_google_fila set metodo=p_metodo,verificado_em=clock_timestamp() where google_key=p_chave returning contexto into v_context;
    update private.radar_url_observadas set url_original=p_url,metodo=p_metodo,estado=v_result->>'estado',verificado_em=clock_timestamp(),
      expira_em=clock_timestamp()+interval '30 days' where google_key=p_chave;
    -- Somente os registros efetivamente corrigidos pelo helper editorial anterior.
    update public.observatorio_conteudos set url_rss=coalesce(url_rss,v_context->>'url_rss',p_chave),url_original=p_url,
      url_resolucao_metodo=p_metodo,url_resolucao_status='resolvido',url_verificada_em=clock_timestamp()
      where url=p_url and agente_origem in ('radar','radar_gemini') and status='revisao' and not revisao_humana
        and not aprovado_curadoria and curadoria_por is null and curadoria_em is null
        and (url_rss=p_chave or private.radar_google_chave(url_rss)=p_chave);
    if p_url is null then
      update public.observatorio_conteudos set url_resolucao_metodo=p_metodo,
        url_resolucao_status=v_result->>'estado',url_verificada_em=clock_timestamp()
        where private.radar_google_chave(url)=p_chave and agente_origem in ('radar','radar_gemini')
          and status='revisao' and not revisao_humana and not aprovado_curadoria
          and curadoria_por is null and curadoria_em is null;
    end if;
  end if;
  return v_result;
end $$;

create or replace function private.radar_url_metadados()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.url is distinct from new.url then
    new.url_rss:=coalesce(old.url_rss,old.url);
    new.url_original:=case when private.radar_google_chave(new.url) is null then new.url end;
    new.url_resolucao_status:=case when new.url_original is not null then 'resolvido' else 'pendente' end;
    new.url_resolucao_metodo:=case when new.url_original is not null then 'direto' end;
    new.url_verificada_em:=clock_timestamp();
  elsif tg_op='INSERT' then
    new.url_rss:=coalesce(new.url_rss,new.url);
    new.url_original:=case when private.radar_google_chave(new.url) is null then new.url end;
    new.url_resolucao_status:=case when new.url_original is not null then 'resolvido' else 'pendente' end;
    new.url_resolucao_metodo:=case when new.url_original is not null then 'direto' end;
    new.url_verificada_em:=case when new.url_original is not null then clock_timestamp() end;
    if new.url_original is not null then
      select o.url_rss,o.metodo into new.url_rss,new.url_resolucao_metodo from private.radar_url_observadas o
        where o.url_original=new.url and o.google_key is not null and o.estado='resolvido'
        order by o.verificado_em desc limit 1;
      new.url_rss:=coalesce(new.url_rss,new.url);
      new.url_resolucao_metodo:=coalesce(new.url_resolucao_metodo,'direto');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists radar_url_metadados on public.observatorio_conteudos;
create trigger radar_url_metadados before insert or update of url on public.observatorio_conteudos for each row execute function private.radar_url_metadados();
update public.observatorio_conteudos set url_rss=url where url_rss is null;

create or replace function public.observatorio_resolucao_evento(p_metodo text,p_estado text,p_http integer default null,p_duracao integer default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into private.radar_url_eventos(metodo,estado,http_status,duracao_ms) values(left(p_metodo,40),left(p_estado,40),p_http,least(120000,greatest(0,p_duracao)));
  delete from private.radar_url_eventos where criado_em<clock_timestamp()-interval '30 days';
end $$;
create or replace function public.observatorio_resolucao_reprocessar(p_chave text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.is_observatorio_admin() or private.is_observatorio_curador()) then raise exception 'Restrito à curadoria' using errcode='42501'; end if;
  update private.radar_google_fila set estado='pendente',tentativas=0,proxima_em=clock_timestamp(),ultimo_motivo=null
    where google_key=p_chave and estado='falhou';
  return jsonb_build_object('ok',found);
end $$;

-- Permissões explícitas inclusive após CREATE OR REPLACE/upgrade.
do $$ declare v record; begin
  for v in select oid::regprocedure as sig from pg_proc where pronamespace='public'::regnamespace
    and proname like 'observatorio_resolucao_%' and proname<>'observatorio_resolucao_reprocessar'
  loop execute format('revoke all on function %s from public,anon,authenticated',v.sig);
    execute format('grant execute on function %s to service_role',v.sig); end loop;
end $$;
revoke all on function private.radar_url_metadados() from public,anon,authenticated,service_role;
revoke all on function public.observatorio_google_fila_finalizar(text,uuid,text,boolean,timestamptz,text) from public,anon,authenticated;
grant execute on function public.observatorio_google_fila_finalizar(text,uuid,text,boolean,timestamptz,text) to service_role;
revoke all on function public.observatorio_resolucao_reprocessar(text) from public,anon;
grant execute on function public.observatorio_resolucao_reprocessar(text) to authenticated;

-- A pausa do Google bloqueia só a última camada, não os feeds oficiais/banco/busca.
create or replace function public.observatorio_google_fila_reservar()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_now timestamptz; v_next timestamptz; v_job private.radar_google_fila%rowtype; v_token uuid;
begin
  select proxima_em into v_next from private.radar_google_fila_controle where id=true for update;
  v_now:=clock_timestamp();
  if v_next>v_now then return jsonb_build_object('situacao','aguardar','retomar_em',v_next); end if;
  if exists(select 1 from private.radar_google_fila where estado='processando' and reserva_ate>v_now) then return jsonb_build_object('situacao','ocupado'); end if;
  update private.radar_google_fila set estado='falhou',token=null,reserva_ate=null where estado='processando' and reserva_ate<=v_now and tentativas>=5;
  select * into v_job from private.radar_google_fila where tentativas<5 and
    ((estado='pendente' and proxima_em<=v_now) or (estado='processando' and reserva_ate<=v_now))
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

create or replace function public.observatorio_google_fila_disparar()
returns bigint language plpgsql security definer set search_path='' as $$
declare v_token text; v_id bigint; v_now timestamptz:=clock_timestamp();
begin
  if exists(select 1 from private.radar_google_fila_controle where id=true and proxima_em>v_now)
    or exists(select 1 from private.radar_google_fila where estado='processando' and reserva_ate>v_now) then return null; end if;
  if not exists(select 1 from private.radar_google_fila where (estado='pendente' and tentativas<5 and proxima_em<=v_now)
    or (estado='processando' and reserva_ate<=v_now)) then return null; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name='radar_agent_token' limit 1;
  if v_token is null or v_token='' then raise exception 'Token da fila ausente no Vault.'; end if;
  select net.http_post(url:='https://brdjzyutqdakabaolxiy.supabase.co/functions/v1/observatorio-radar',
    headers:=jsonb_build_object('Content-Type','application/json','x-radar-token',v_token),
    body:=jsonb_build_object('acao','processar_fila_google'),timeout_milliseconds:=60000) into v_id;
  return v_id;
end $$;
revoke all on function public.observatorio_google_fila_disparar() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
