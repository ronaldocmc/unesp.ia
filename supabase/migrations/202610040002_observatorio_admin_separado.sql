alter table if exists public.papeis_usuario
  drop constraint if exists papeis_usuario_papel_check;

alter table if exists public.papeis_usuario
  add constraint papeis_usuario_papel_check
  check (papel in ('administrador','instrutor','observatorio_admin'));

create or replace function private.is_observatorio_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.papeis_usuario
    where user_id = (select auth.uid()) and papel in ('administrador','observatorio_admin')
  );
$$;

grant execute on function private.is_observatorio_admin() to authenticated;

drop policy if exists observatorio_curadoria_admin on public.observatorio_conteudos;
create policy observatorio_curadoria_admin on public.observatorio_conteudos
for all to authenticated
using ((select private.is_observatorio_admin()))
with check ((select private.is_observatorio_admin()));

drop policy if exists observatorio_categorias_curadoria_admin on public.observatorio_categorias;
create policy observatorio_categorias_curadoria_admin on public.observatorio_categorias
for all to authenticated
using ((select private.is_observatorio_admin()))
with check ((select private.is_observatorio_admin()));

drop policy if exists observatorio_veiculos_curadoria_admin on public.observatorio_veiculos;
create policy observatorio_veiculos_curadoria_admin on public.observatorio_veiculos
for all to authenticated
using ((select private.is_observatorio_admin()))
with check ((select private.is_observatorio_admin()));

drop policy if exists observatorio_curadoria_select on public.papeis_usuario;
create policy observatorio_curadoria_select on public.papeis_usuario
for select to authenticated
using (user_id = (select auth.uid()) and papel = 'observatorio_admin');
