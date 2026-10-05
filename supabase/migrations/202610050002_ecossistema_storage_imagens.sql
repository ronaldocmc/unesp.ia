insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ecossistema-imagens',
  'ecossistema-imagens',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ecossistema_imagens_public_select on storage.objects;
create policy ecossistema_imagens_public_select
on storage.objects for select
using (bucket_id = 'ecossistema-imagens');

drop policy if exists ecossistema_imagens_admin_insert on storage.objects;
create policy ecossistema_imagens_admin_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ecossistema-imagens'
  and exists (
    select 1
    from public.papeis_usuario papel
    where papel.user_id = auth.uid()
      and papel.papel = 'administrador'
  )
);

drop policy if exists ecossistema_imagens_admin_update on storage.objects;
create policy ecossistema_imagens_admin_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'ecossistema-imagens'
  and exists (
    select 1
    from public.papeis_usuario papel
    where papel.user_id = auth.uid()
      and papel.papel = 'administrador'
  )
)
with check (
  bucket_id = 'ecossistema-imagens'
  and exists (
    select 1
    from public.papeis_usuario papel
    where papel.user_id = auth.uid()
      and papel.papel = 'administrador'
  )
);

drop policy if exists ecossistema_imagens_admin_delete on storage.objects;
create policy ecossistema_imagens_admin_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ecossistema-imagens'
  and exists (
    select 1
    from public.papeis_usuario papel
    where papel.user_id = auth.uid()
      and papel.papel = 'administrador'
  )
);
