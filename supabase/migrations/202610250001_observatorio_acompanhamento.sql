-- Consulta administrativa somente leitura. Requer migrations de curadoria e resolução.
begin;
create or replace view private.observatorio_acompanhamento_base as
select 'editorial'::text as fila,c.id::text as chave,c.id as conteudo_id,c.titulo,
  coalesce(nullif(c.veiculo,''),c.fonte,'') as veiculo,coalesce(c.fonte,'') as fonte,c.categoria,
  c.origem,''::text as feed,
  case when c.status='arquivado' then 'arquivado'
    when c.status='publicado' and c.revisao_humana then 'publicado'
    when c.status='revisao' then 'revisao' else 'aguardando_curadoria' end as situacao,
  c.status as status_cadastro,c.revisao_humana,c.aprovado_curadoria,
  coalesce(c.url_rss,c.url) as url_rss,c.url_original,
  coalesce(nullif(c.url_original,''),nullif(c.url,''),c.url_rss) as url_evidencia,
  coalesce(c.url_resolucao_status,'nao_informado') as estado_link,
  c.url_resolucao_metodo as metodo,0 as tentativas,null::text as motivo,
  c.created_at as criado_em,c.updated_at as atualizado_em,null::timestamptz as proxima_em,
  c.data_publicacao::text as data_publicacao
from public.observatorio_conteudos c
union all
select 'tecnica',q.google_key,c.id,coalesce(nullif(q.contexto->>'titulo',''),c.titulo,'Título não informado'),
  coalesce(nullif(q.contexto->>'veiculo',''),c.veiculo,c.fonte,''),coalesce(c.fonte,q.contexto->>'veiculo',''),
  coalesce(c.categoria,''),coalesce(c.origem,'Fila de links'),
  coalesce(q.contexto->>'feed_codigo',q.contexto->>'feed_nome',q.contexto->>'feed_id',''),
  case when q.estado='pendente' and q.proxima_em>clock_timestamp() then 'agendado' else q.estado end,
  c.status,c.revisao_humana,c.aprovado_curadoria,q.google_key,q.url_original,
  coalesce(nullif(q.url_original,''),q.google_key),q.estado,q.metodo,q.tentativas,q.ultimo_motivo,
  q.criado_em,q.atualizado_em,q.proxima_em,coalesce(q.contexto->>'data',c.data_publicacao::text)
from private.radar_google_fila q
left join lateral (
  select c.* from public.observatorio_conteudos c
  where private.radar_google_chave(c.url)=q.google_key or private.radar_google_chave(c.url_rss)=q.google_key
  order by c.updated_at desc,c.id desc limit 1
) c on true
union all
select 'descartes',d.url_key,null::bigint,d.titulo,coalesce(d.fonte,''),coalesce(d.fonte,''),
  ''::text,'Agente Radar',''::text,'descartado','descartado',null::boolean,null::boolean,
  d.url,null::text,d.url,'nao_informado',null::text,0,d.motivo,d.descartado_em,d.descartado_em,
  null::timestamptz,null::text
from public.observatorio_radar_descartes d where d.ativo;
revoke all on private.observatorio_acompanhamento_base from public,anon,authenticated;

create or replace function public.observatorio_acompanhamento(
  p_fila text default 'editorial',p_filtros jsonb default '{}'::jsonb,p_pagina integer default 1,p_tamanho integer default 25
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_inicio date; v_fim date;
begin
  if not coalesce(private.is_observatorio_admin(),false) then raise exception 'Acesso restrito à administração.' using errcode='42501'; end if;
  if p_fila is null or p_fila not in ('editorial','tecnica','descartes') or p_pagina is null or p_pagina<1 or p_pagina>100000
    or p_tamanho is null or p_tamanho not between 1 and 100 or p_filtros is null
    or jsonb_typeof(p_filtros)<>'object' or octet_length(p_filtros::text)>4000 then raise exception 'Filtros ou paginação inválidos.'; end if;
  v_inicio:=nullif(p_filtros->>'inicio','')::date; v_fim:=nullif(p_filtros->>'fim','')::date;
  if v_fim<v_inicio then raise exception 'Período inválido.'; end if;
  with base as (
    select b.*,case when nullif(b.url_evidencia,'') is null or b.url_evidencia !~* '^https?://[^[:space:]]+' then 'ausente'
      when b.url_evidencia ~* '^https?://news[.]google[.]com/' then 'google_rss' else 'direta' end as evidencia
    from private.observatorio_acompanhamento_base b where b.fila=p_fila
  ), filtrados as materialized (
    select * from base b where
      (v_inicio is null or b.criado_em>=v_inicio::timestamp at time zone 'America/Sao_Paulo')
      and (v_fim is null or b.criado_em<(v_fim+1)::timestamp at time zone 'America/Sao_Paulo')
      and (coalesce(p_filtros->>'busca','')='' or strpos(lower(concat_ws(' ',b.titulo,b.veiculo,b.fonte,b.motivo)),lower(p_filtros->>'busca'))>0)
      and (coalesce(p_filtros->>'veiculo','')='' or strpos(lower(b.veiculo),lower(p_filtros->>'veiculo'))>0)
      and (coalesce(p_filtros->>'fonte','')='' or strpos(lower(b.fonte),lower(p_filtros->>'fonte'))>0)
      and (coalesce(p_filtros->>'categoria','')='' or strpos(lower(b.categoria),lower(p_filtros->>'categoria'))>0)
      and (coalesce(p_filtros->>'origem','')='' or strpos(lower(b.origem),lower(p_filtros->>'origem'))>0)
      and (coalesce(p_filtros->>'feed','')='' or (p_filtros->>'feed'='nao_informado' and b.feed='') or strpos(lower(b.feed),lower(p_filtros->>'feed'))>0)
      and (coalesce(p_filtros->>'situacao','')='' or b.situacao=p_filtros->>'situacao')
      and (coalesce(p_filtros->>'estado_link','')='' or b.estado_link=p_filtros->>'estado_link')
      and (coalesce(p_filtros->>'evidencia','')='' or b.evidencia=p_filtros->>'evidencia')
      and (coalesce(p_filtros->>'revisao','')='' or b.revisao_humana=(p_filtros->>'revisao')::boolean)
  ), pagina as (
    select * from filtrados order by atualizado_em desc,chave limit p_tamanho offset ((p_pagina-1)*p_tamanho)
  ) select jsonb_build_object(
    'total',(select count(*) from filtrados),'pagina',p_pagina,'tamanho',p_tamanho,
    'contadores',coalesce((select jsonb_object_agg(situacao,n) from (select situacao,count(*) as n from filtrados group by situacao) t),'{}'::jsonb),
    'aguardando_validacao',(select count(*) from filtrados where fila='editorial' and situacao in ('aguardando_curadoria','revisao')),
    'itens',coalesce((select jsonb_agg(to_jsonb(p) order by atualizado_em desc,chave) from pagina p),'[]'::jsonb),
    'origens',case when p_fila='tecnica' then coalesce((select jsonb_agg(to_jsonb(o) order by origem) from (
      select origem,dia,quantidade,proxima_em,pausado_ate from private.radar_url_origens
    ) o),'[]'::jsonb) else '[]'::jsonb end,
    'consultado_em',clock_timestamp()
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.observatorio_acompanhamento(text,jsonb,integer,integer) from public,anon;
grant execute on function public.observatorio_acompanhamento(text,jsonb,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
