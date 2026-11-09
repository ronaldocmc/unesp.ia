begin;

-- A projeção pública lê como proprietária: predicado fixo e colunas explícitas.
create view public.observatorio_acervo_publico with (security_barrier=true) as
select id, colecao, tipo, categoria, titulo, resumo, projeto_relacionado, veiculo,
       data_publicacao, url, url_original, url_rss, imagem_url, destaque,
       palavras_chave, fonte, status, revisao_humana
from public.observatorio_conteudos where status='publicado' and revisao_humana is true;
revoke all on public.observatorio_acervo_publico from public,anon,authenticated;
grant select on public.observatorio_acervo_publico to anon,authenticated;
drop policy if exists observatorio_publico on public.observatorio_conteudos;
revoke all on public.observatorio_conteudos from public,anon;
drop policy if exists observatorio_autenticado_select on public.observatorio_conteudos;
create policy observatorio_autenticado_select on public.observatorio_conteudos for select to authenticated
  using (submetido_por=(select auth.uid()) or (select private.is_admin()));
-- Limite superior mesmo se houver outra política permissiva de leitura no servidor.
alter table public.observatorio_conteudos enable row level security;
create policy observatorio_limite_leitura on public.observatorio_conteudos
  as restrictive for select to authenticated using (
    submetido_por=(select auth.uid()) or (select private.is_admin())
    or (select private.is_observatorio_admin()) or (select private.is_observatorio_curador())
  );
-- Políticas separadas da curadoria/admin continuam em vigor.

-- Apenas um contador por escopo. Janela fixa; atualização atômica entre processos.
create table private.observatorio_cotas_minuto (
  escopo text primary key, janela timestamptz not null, quantidade integer not null
);
alter table private.observatorio_cotas_minuto enable row level security;
revoke all on private.observatorio_cotas_minuto from public,anon,authenticated;
create function private.observatorio_consumir_cota(chave text, teto integer)
returns boolean language plpgsql set search_path='' as $$
declare janela_atual timestamptz := date_trunc('minute',clock_timestamp());
begin
  insert into private.observatorio_cotas_minuto as c values(chave,janela_atual,1)
  on conflict(escopo) do update set janela=excluded.janela,
    quantidade=case when c.janela<excluded.janela then 1 else c.quantidade+1 end
  where c.janela<excluded.janela or (c.janela=excluded.janela and c.quantidade<teto);
  return found;
end $$;
revoke all on function private.observatorio_consumir_cota(text,integer) from public,anon,authenticated;

create function public.observatorio_importador_reservar()
returns text language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not (coalesce(private.is_observatorio_admin(),false)
     or coalesce(private.is_observatorio_curador(),false)) then return 'negado'; end if;
  if not private.observatorio_consumir_cota('importador:'||auth.uid()::text,10) then return 'limite'; end if;
  if not private.observatorio_consumir_cota('importador',60) then return 'limite'; end if;
  return 'ok';
end $$;
revoke all on function public.observatorio_importador_reservar() from public,anon;
grant execute on function public.observatorio_importador_reservar() to authenticated;

alter function public.observatorio_acesso_registrar(uuid,text,bigint) set schema private;
revoke all on function private.observatorio_acesso_registrar(uuid,text,bigint) from public,anon,authenticated;
create function public.observatorio_acesso_registrar(p_sessao uuid,p_evento text,p_conteudo bigint default 0)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_sessao is null or p_conteudo is null or p_evento is null or
     p_evento not in ('visita','visualizacao','clique_original','clique_fallback') then return false; end if;
  if not private.observatorio_consumir_cota('metricas:'||p_evento,600) then return false; end if;
  return private.observatorio_acesso_registrar(p_sessao,p_evento,p_conteudo);
end $$;
revoke all on function public.observatorio_acesso_registrar(uuid,text,bigint) from public;
grant execute on function public.observatorio_acesso_registrar(uuid,text,bigint) to anon,authenticated;
notify pgrst,'reload schema';
commit;
