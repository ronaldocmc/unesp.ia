-- Aplicar após 202610310002. Preserva visitas e histórico; não infere método antigo.
begin;
alter table private.observatorio_acessos_geo_dia add column if not exists metodo text not null default 'legado';
alter table private.observatorio_acessos_geo_dia add column if not exists celula text not null default '';
alter table private.observatorio_acessos_geo_dia drop constraint observatorio_acessos_geo_dia_pkey;
alter table private.observatorio_acessos_geo_dia add primary key(dia,pais,regiao,cidade,metodo,celula);
-- Chave do agregado anterior apenas para substituir IP por navegador sem duplicação.
-- Mesmo prazo efêmero dos recibos; sem vínculo com contas e sem coordenadas brutas.
alter table private.observatorio_acessos_geo_recibos add column if not exists registro jsonb;
alter table private.observatorio_acessos_geo_recibos add column if not exists navegador boolean not null default false;

create or replace function public.observatorio_acesso_geo_reservar_v2(p_sessao uuid,p_consultar boolean default false,p_navegador boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date;
 r private.observatorio_acessos_geo_recibos; c private.observatorio_geo_controle; t uuid; consulta boolean:=false;
begin
 if p_sessao is null or not exists(select 1 from private.observatorio_acessos_recibos
   where dia=d and sessao=p_sessao and evento='visita' and conteudo_id=0) then return jsonb_build_object('reservado',false); end if;
 perform pg_advisory_xact_lock(310031,2);
 select * into r from private.observatorio_acessos_geo_recibos where dia=d and sessao=p_sessao;
 if found then
   if r.navegador or (not r.concluido and r.expira_em>clock_timestamp()) or (r.concluido and not p_navegador)
     -- Recibos pré-migration não têm chave segura para subtrair seu agregado.
     or (r.concluido and r.registro is null) then return jsonb_build_object('reservado',false); end if;
 end if;
 t:=gen_random_uuid();
 insert into private.observatorio_acessos_geo_recibos(dia,sessao,token,expira_em,concluido)
 values(d,p_sessao,t,clock_timestamp()+interval '1 minute',false)
 on conflict(dia,sessao) do update set token=excluded.token,expira_em=excluded.expira_em,concluido=false;
 insert into private.observatorio_geo_controle(id,dia) values(true,d) on conflict do nothing;
 select * into c from private.observatorio_geo_controle where id=true;
 if c.dia<>d then update private.observatorio_geo_controle set dia=d,consultas=0 where id=true; c.consultas:=0; end if;
 if not p_navegador and p_consultar and c.consultas<500 and c.proxima_em<=clock_timestamp()
   and (c.pausado_ate is null or c.pausado_ate<=clock_timestamp()) then
   update private.observatorio_geo_controle set consultas=consultas+1,proxima_em=clock_timestamp()+interval '2 seconds' where id=true;
   consulta:=true;
 end if;
 delete from private.observatorio_acessos_geo_recibos where dia<d-2;
 return jsonb_build_object('reservado',true,'consultar',consulta,'token',t,'dia',d);
end $$;

-- Mantém a assinatura usada pela versão anterior da Edge Function.
create or replace function public.observatorio_acesso_geo_reservar(p_sessao uuid,p_consultar boolean default false)
returns jsonb language sql security definer set search_path='' as $$
 select public.observatorio_acesso_geo_reservar_v2(p_sessao,p_consultar,false);
$$;

create or replace function public.observatorio_acesso_geo_finalizar(p_sessao uuid,p_token uuid,p_dia date,p_geo jsonb default '{}',p_pausa_segundos integer default 0)
returns boolean language plpgsql security definer set search_path='' as $$
declare r private.observatorio_acessos_geo_recibos; pais text:='';regiao text:='';cidade text:='';
 lat numeric;lon numeric;metodo text:='nao_identificado';celula text:='';anterior jsonb;
begin
 if p_geo is null or jsonb_typeof(p_geo)<>'object' or octet_length(p_geo::text)>2000 then return false; end if;
 if jsonb_typeof(p_geo->'latitude')='number' and jsonb_typeof(p_geo->'longitude')='number' then
   lat:=(p_geo->>'latitude')::numeric;lon:=(p_geo->>'longitude')::numeric;
   if lat not between -90 and 90 or lon not between -180 and 180 then lat:=null;lon:=null; end if;
 end if;
 if p_geo->>'metodo'='navegador' and lat is not null and lon is not null then
   metodo:='navegador';lat:=round(lat,2);lon:=round(lon,2);celula:=lat::text||','||lon::text;
 elsif coalesce(p_geo->>'pais','') ~ '^[A-Z]{2}$' then
   metodo:='ip';pais:=p_geo->>'pais';regiao:=left(btrim(coalesce(p_geo->>'regiao','')),100);cidade:=left(btrim(coalesce(p_geo->>'cidade','')),100);
   lat:=round(lat,1);lon:=round(lon,1);
 else lat:=null;lon:=null;
 end if;
 perform pg_advisory_xact_lock(310031,2);
 select * into r from private.observatorio_acessos_geo_recibos where dia=p_dia and sessao=p_sessao
   and token=p_token and not concluido and expira_em>clock_timestamp() for update;
 if not found then return false; end if;
 anterior:=r.registro;
 if anterior is not null then
   delete from private.observatorio_acessos_geo_dia g where g.dia=p_dia and g.pais=anterior->>'pais'
    and g.regiao=anterior->>'regiao' and g.cidade=anterior->>'cidade' and g.metodo=anterior->>'metodo'
    and g.celula=anterior->>'celula' and g.quantidade=1;
   update private.observatorio_acessos_geo_dia g set quantidade=g.quantidade-1 where g.dia=p_dia and g.pais=anterior->>'pais'
    and g.regiao=anterior->>'regiao' and g.cidade=anterior->>'cidade' and g.metodo=anterior->>'metodo'
    and g.celula=anterior->>'celula';
 end if;
 insert into private.observatorio_acessos_geo_dia(dia,pais,regiao,cidade,latitude,longitude,quantidade,metodo,celula)
 values(p_dia,pais,regiao,cidade,lat,lon,1,metodo,celula)
 on conflict on constraint observatorio_acessos_geo_dia_pkey do update set quantidade=observatorio_acessos_geo_dia.quantidade+1;
 update private.observatorio_acessos_geo_recibos set concluido=true,navegador=(metodo='navegador'),
   registro=jsonb_build_object('pais',pais,'regiao',regiao,'cidade',cidade,'metodo',metodo,'celula',celula)
 where dia=p_dia and sessao=p_sessao;
 if p_pausa_segundos>0 then
   update private.observatorio_geo_controle set pausado_ate=greatest(coalesce(pausado_ate,clock_timestamp()),
     clock_timestamp()+p_pausa_segundos*interval '1 second') where id=true;
 end if;
 return true;
end $$;
revoke all on function public.observatorio_acesso_geo_reservar_v2(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.observatorio_acesso_geo_reservar_v2(uuid,boolean,boolean) to service_role;

create or replace function public.observatorio_acessos_geografia(p_inicio date,p_fim date,p_pais text default '',p_regiao text default '',p_cidade text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare resultado jsonb;
begin
 if not coalesce(private.is_observatorio_admin(),false) then raise exception 'Acesso restrito à administração.' using errcode='42501'; end if;
 if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366
   or p_pais is null or (p_pais<>'' and p_pais !~ '^[A-Z]{2}$') or p_regiao is null or length(p_regiao)>100
   or p_cidade is null or length(p_cidade)>100 then raise exception 'Filtros inválidos. Selecione até 367 dias.'; end if;
 with periodo as materialized (
   select * from private.observatorio_acessos_geo_dia where dia between p_inicio and p_fim
 ), locais as materialized (
   select pais,regiao,cidade,metodo,celula,
    (array_agg(latitude order by dia desc) filter(where latitude is not null and longitude is not null))[1] as latitude,
    (array_agg(longitude order by dia desc) filter(where latitude is not null and longitude is not null))[1] as longitude,
    sum(quantidade) as quantidade
   from periodo where (p_pais='' or pais=p_pais) and (p_regiao='' or strpos(lower(regiao),lower(p_regiao))>0)
    and (p_cidade='' or strpos(lower(cidade),lower(p_cidade))>0)
   group by pais,regiao,cidade,metodo,celula
 ) select jsonb_build_object(
  'locais',coalesce((select jsonb_agg(to_jsonb(l) order by quantidade desc,pais,regiao,cidade,metodo,celula) from
   (select * from locais order by quantidade desc,pais,regiao,cidade,metodo,celula limit 1000) l),'[]'::jsonb),
  'total_locais',(select count(*) from locais),'visitas_filtradas',coalesce((select sum(quantidade) from locais),0),
  'visitas_periodo',coalesce((select sum(quantidade) from private.observatorio_acessos_dia where dia between p_inicio and p_fim and evento='visita'),0),
  'geografia_registrada',coalesce((select sum(quantidade) from periodo),0),
  'localizadas',coalesce((select sum(quantidade) from periodo where pais<>'' or (latitude is not null and longitude is not null)),0),
  'nao_identificadas',coalesce((select sum(quantidade) from periodo where pais='' and latitude is null),0),
  'consultado_em',clock_timestamp()
 ) into resultado;
 return resultado;
end $$;
notify pgrst,'reload schema';
commit;
