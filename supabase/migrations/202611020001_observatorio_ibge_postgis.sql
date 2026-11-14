-- Requer 202611010001. Base pública territorial, mantida em tabela privada.
begin;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
do $$ begin
 if not exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis' and n.nspname='extensions') then
  raise exception 'PostGIS já existe em outro schema. Não remova a extensão: adapte os qualificadores desta migração ao schema existente.';
 end if;
end $$;
create table if not exists private.observatorio_ibge_municipios (
 codigo_ibge text primary key check(codigo_ibge ~ '^[0-9]{7}$'),
 nome text not null check(length(nome) between 1 and 100),
 uf text not null check(length(uf) between 1 and 100),
 geojson jsonb not null check(geojson->>'type'='MultiPolygon'),
 geom extensions.geometry(MultiPolygon,4326) generated always as
  (extensions.st_setsrid(extensions.st_geomfromgeojson(geojson::text),4326)) stored,
 base_geografica text not null default 'IBGE-malhas-2022-simplificada'
  check(base_geografica='IBGE-malhas-2022-simplificada'),
 check(extensions.st_isvalid(geom) and not extensions.st_isempty(geom))
);
alter table private.observatorio_ibge_municipios enable row level security;
revoke all on private.observatorio_ibge_municipios from public,anon,authenticated,service_role;
create index if not exists observatorio_ibge_municipios_geom_idx
 on private.observatorio_ibge_municipios using gist(geom);
create or replace function public.observatorio_municipio_ibge(p_latitude numeric,p_longitude numeric)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='2s' as $$
declare cell extensions.geometry; result jsonb; hits integer;
begin
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90)
  or not(p_longitude between -180 and 180) then return '{}'::jsonb; end if;
 -- Uma importação parcial não pode produzir uma atribuição aparentemente inequívoca.
 if (select count(*) from private.observatorio_ibge_municipios)<>5570 then return '{}'::jsonb; end if;
 cell:=extensions.st_makeenvelope(round(p_longitude,2)-0.005001,round(p_latitude,2)-0.005001,
  round(p_longitude,2)+0.005001,round(p_latitude,2)+0.005001,4326);
 -- Mais de um município intersectando a célula => divisa/ambiguidade.
 select count(*), (jsonb_agg(jsonb_build_object('pais','BR','regiao',m.uf,'cidade',m.nome,
  'codigo_ibge',m.codigo_ibge,'base_geografica',m.base_geografica))
  filter(where extensions.st_containsproperly(m.geom,cell)))->0
 into hits,result from private.observatorio_ibge_municipios m
 where extensions.st_isvalid(m.geom) and extensions.st_intersects(m.geom,cell);
 if hits=1 then return coalesce(result,'{}'::jsonb); end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.observatorio_municipio_ibge(numeric,numeric) from public,anon,authenticated;
grant execute on function public.observatorio_municipio_ibge(numeric,numeric) to service_role;
notify pgrst,'reload schema';
commit;
