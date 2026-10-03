-- Sugestões autenticadas para a fila de curadoria do Observar.IA.
alter table if exists public.observatorio_conteudos
  add column if not exists submetido_por uuid references auth.users(id) on delete set null,
  add column if not exists submetido_email text,
  add column if not exists observacao_colaborador text;

create index if not exists observatorio_curadoria_idx
  on public.observatorio_conteudos(status, revisao_humana, updated_at desc);

drop policy if exists observatorio_autenticado_select on public.observatorio_conteudos;
create policy observatorio_autenticado_select on public.observatorio_conteudos
for select to authenticated using (
  status = 'publicado' and revisao_humana = true
  or submetido_por = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists observatorio_colaborador_insert on public.observatorio_conteudos;
create policy observatorio_colaborador_insert on public.observatorio_conteudos
for insert to authenticated with check (
  submetido_por = (select auth.uid())
  and origem = 'Usuário identificado'
  and status = 'revisao'
  and revisao_humana = false
  and destaque = false
);
