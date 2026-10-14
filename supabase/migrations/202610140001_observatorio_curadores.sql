-- Perfil de curadoria: várias contas independentes, com acesso editorial ao acervo.
begin;

alter table public.papeis_usuario drop constraint if exists papeis_usuario_papel_check;
alter table public.papeis_usuario add constraint papeis_usuario_papel_check
  check (papel in ('administrador', 'instrutor', 'observatorio_admin', 'observatorio_curador'));

create or replace function private.is_observatorio_curador()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.papeis_usuario
    where user_id = (select auth.uid()) and papel = 'observatorio_curador');
$$;
revoke all on function private.is_observatorio_curador() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_observatorio_curador() to authenticated;

drop policy if exists observatorio_curador_select on public.observatorio_conteudos;
create policy observatorio_curador_select on public.observatorio_conteudos
for select to authenticated using ((select private.is_observatorio_curador()));
drop policy if exists observatorio_curador_insert on public.observatorio_conteudos;
create policy observatorio_curador_insert on public.observatorio_conteudos
for insert to authenticated with check ((select private.is_observatorio_curador()));
drop policy if exists observatorio_curador_update on public.observatorio_conteudos;
create policy observatorio_curador_update on public.observatorio_conteudos
for update to authenticated using ((select private.is_observatorio_curador()))
with check ((select private.is_observatorio_curador()));
-- A exclusão permanente e a gestão das demais tabelas continuam administrativas.
grant select, insert, update on public.observatorio_conteudos to authenticated;
grant usage, select on sequence public.observatorio_conteudos_id_seq to authenticated;
grant select on public.papeis_usuario to authenticated;
drop policy if exists observatorio_curador_papel_proprio on public.papeis_usuario;
create policy observatorio_curador_papel_proprio on public.papeis_usuario
for select to authenticated using (user_id = (select auth.uid()) and papel = 'observatorio_curador');

create or replace function public.observatorio_listar_curadores()
returns table (user_id uuid, email text, nome text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_observatorio_admin() then
    raise exception 'Somente administradores podem gerenciar a curadoria.' using errcode = '42501';
  end if;
  return query select p.user_id, u.email::text,
    coalesce(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', ''), p.created_at
    from public.papeis_usuario p join auth.users u on u.id = p.user_id
    where p.papel = 'observatorio_curador' order by u.email;
end;
$$;

create or replace function public.observatorio_conceder_curadoria(p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_role text;
begin
  if not private.is_observatorio_admin() then
    raise exception 'Somente administradores podem gerenciar a curadoria.' using errcode = '42501';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Conta não encontrada. Crie primeiro a conta no Supabase Authentication e informe o mesmo e-mail.';
  end if;
  -- Serializa concessões concorrentes e preserva papéis já atribuídos.
  perform 1 from auth.users where id = v_id for update;
  select papel into v_role from public.papeis_usuario where user_id = v_id;
  if v_role is not null and v_role <> 'observatorio_curador' then
    raise exception 'Esta conta já possui outro perfil (%). Use uma conta sem perfil administrativo ou de instrutor.', v_role;
  end if;
  insert into public.papeis_usuario(user_id, papel) values (v_id, 'observatorio_curador')
    on conflict (user_id) do nothing;
  return v_id;
end;
$$;

create or replace function public.observatorio_revogar_curadoria(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_observatorio_admin() then
    raise exception 'Somente administradores podem gerenciar a curadoria.' using errcode = '42501';
  end if;
  delete from public.papeis_usuario where user_id = p_user_id and papel = 'observatorio_curador';
  return found;
end;
$$;

revoke all on function public.observatorio_listar_curadores() from public, anon;
revoke all on function public.observatorio_conceder_curadoria(text) from public, anon;
revoke all on function public.observatorio_revogar_curadoria(uuid) from public, anon;
grant execute on function public.observatorio_listar_curadores() to authenticated;
grant execute on function public.observatorio_conceder_curadoria(text) to authenticated;
grant execute on function public.observatorio_revogar_curadoria(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
