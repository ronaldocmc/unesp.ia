-- Métricas agregadas, sem IP, user-agent, identidade ou URL de navegação.
begin;
create table if not exists private.observatorio_acessos_dia (
  dia date not null,
  evento text not null check (evento in ('visita','visualizacao','clique_original','clique_fallback')),
  conteudo_id bigint not null default 0,
  quantidade bigint not null default 0 check (quantidade >= 0),
  primary key(dia,evento,conteudo_id)
);
-- Identificador aleatório efêmero: deduplicação apenas; não identifica pessoa.
create table if not exists private.observatorio_acessos_recibos (
  dia date not null, sessao uuid not null, evento text not null, conteudo_id bigint not null,
  primary key(dia,sessao,evento,conteudo_id)
);
alter table private.observatorio_acessos_dia enable row level security;
alter table private.observatorio_acessos_recibos enable row level security;
revoke all on private.observatorio_acessos_dia, private.observatorio_acessos_recibos from public,anon,authenticated;

create or replace function public.observatorio_acesso_registrar(p_sessao uuid, p_evento text, p_conteudo bigint default 0)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_dia date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date; v_rows integer;
begin
  if p_sessao is null or p_evento is null or p_conteudo is null or
    p_evento not in ('visita','visualizacao','clique_original','clique_fallback') then return false; end if;
  if p_evento='visita' then
    if p_conteudo<>0 then return false; end if;
  elsif not exists(select 1 from public.observatorio_conteudos
    where id=p_conteudo and status='publicado' and revisao_humana=true) then return false;
  end if;
  -- Limite por sessão (não substitui proteção de borda contra robôs maliciosos).
  if (select count(*) from private.observatorio_acessos_recibos where dia=v_dia and sessao=p_sessao)>=500 then return false; end if;
  insert into private.observatorio_acessos_recibos values(v_dia,p_sessao,p_evento,p_conteudo) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows=0 then return false; end if;
  insert into private.observatorio_acessos_dia values(v_dia,p_evento,p_conteudo,1)
    on conflict(dia,evento,conteudo_id) do update set quantidade=private.observatorio_acessos_dia.quantidade+1;
  -- Recibos antigos são dispensáveis; os totais históricos permanecem.
  delete from private.observatorio_acessos_recibos where dia<v_dia-2;
  return true;
end $$;
revoke all on function public.observatorio_acesso_registrar(uuid,text,bigint) from public;
grant execute on function public.observatorio_acesso_registrar(uuid,text,bigint) to anon,authenticated;

create or replace function public.observatorio_acessos_resumo(p_inicio date, p_fim date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not coalesce(private.is_observatorio_admin(),false) then raise exception 'Acesso restrito à administração.' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>366 then raise exception 'Selecione até 367 dias.'; end if;
  select jsonb_build_object(
    'diario',coalesce((select jsonb_agg(to_jsonb(t) order by t.dia,t.evento) from (
      select dia,evento,sum(quantidade) as quantidade from private.observatorio_acessos_dia
      where dia between p_inicio and p_fim group by dia,evento) t),'[]'::jsonb),
    'mensal',coalesce((select jsonb_agg(to_jsonb(t) order by t.mes,t.evento) from (
      select to_char(dia,'YYYY-MM') as mes,evento,sum(quantidade) as quantidade from private.observatorio_acessos_dia
      where dia between p_inicio and p_fim group by to_char(dia,'YYYY-MM'),evento) t),'[]'::jsonb),
    'conteudos',coalesce((select jsonb_agg(to_jsonb(t) order by t.quantidade desc) from (
      select a.conteudo_id,coalesce(c.titulo,'Conteúdo removido') as titulo,a.evento,sum(a.quantidade) as quantidade
      from private.observatorio_acessos_dia a left join public.observatorio_conteudos c on c.id=a.conteudo_id
      where a.dia between p_inicio and p_fim and a.conteudo_id<>0
      group by a.conteudo_id,c.titulo,a.evento order by sum(a.quantidade) desc,a.conteudo_id,a.evento limit 100) t),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.observatorio_acessos_resumo(date,date) from public;
grant execute on function public.observatorio_acessos_resumo(date,date) to authenticated;
commit;
