-- Portal acadêmico unesp.IA - schema, integridade e autorização por matrícula.
create extension if not exists pgcrypto;
create extension if not exists citext;
create schema if not exists private;

create table public.modulos (
  id bigint generated always as identity primary key,
  codigo text not null unique check (codigo ~ '^M[0-9]+$'),
  descricao text not null check (length(trim(descricao)) >= 3),
  carga_horaria numeric(6,2) not null check (carga_horaria > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.turmas (
  id bigint generated always as identity primary key,
  descricao text not null check (length(trim(descricao)) >= 3),
  modulo_id bigint not null references public.modulos(id) on update cascade on delete restrict,
  data_inicio date not null,
  data_fim date,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim is null or data_fim >= data_inicio)
);

create table public.participantes (
  id bigint generated always as identity primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text not null check (length(trim(nome)) >= 3),
  cpf varchar(11) not null unique check (cpf ~ '^[0-9]{11}$'),
  telefone text,
  email citext not null unique,
  genero text,
  escolaridade text,
  endereco text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matriculas (
  turma_id bigint not null references public.turmas(id) on update cascade on delete cascade,
  participante_id bigint not null references public.participantes(id) on update cascade on delete cascade,
  status text not null default 'ativa' check (status in ('ativa','concluida','cancelada','trancada')),
  matriculado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (turma_id, participante_id)
);

create table public.encontros (
  id bigint generated always as identity primary key,
  turma_id bigint not null references public.turmas(id) on update cascade on delete cascade,
  data date not null,
  conteudo_ministrado text not null check (length(trim(conteudo_ministrado)) >= 3),
  carga_horaria numeric(5,2) not null default 1 check (carga_horaria > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turma_id, data)
);

create table public.frequencias (
  encontro_id bigint not null references public.encontros(id) on update cascade on delete cascade,
  participante_id bigint not null references public.participantes(id) on update cascade on delete cascade,
  presente boolean not null default true,
  observacao text,
  registrado_em timestamptz not null default now(),
  primary key (encontro_id, participante_id)
);

create table public.papeis_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('administrador','instrutor')),
  created_at timestamptz not null default now()
);

create table public.conteudos_modulo (
  id bigint generated always as identity primary key,
  modulo_id bigint not null references public.modulos(id) on update cascade on delete cascade,
  titulo text not null,
  ordem integer not null default 1 check (ordem > 0),
  html text,
  storage_path text,
  publicado boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (modulo_id, ordem),
  check ((html is not null) <> (storage_path is not null))
);

create index turmas_modulo_idx on public.turmas(modulo_id);
create index participantes_auth_idx on public.participantes(auth_user_id);
create index matriculas_participante_idx on public.matriculas(participante_id, status);
create index encontros_turma_idx on public.encontros(turma_id, data);
create index frequencias_participante_idx on public.frequencias(participante_id);
create index conteudos_modulo_idx on public.conteudos_modulo(modulo_id, publicado, ordem);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.papeis_usuario
    where user_id = (select auth.uid()) and papel = 'administrador'
  );
$$;

create or replace function private.participante_atual_id()
returns bigint language sql stable security definer set search_path = '' as $$
  select id from public.participantes where auth_user_id = (select auth.uid()) and ativo limit 1;
$$;

create or replace function private.pode_acessar_modulo(p_modulo_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists (
    select 1
    from public.participantes p
    join public.matriculas ma on ma.participante_id = p.id and ma.status = 'ativa'
    join public.turmas t on t.id = ma.turma_id and t.ativa
    where p.auth_user_id = (select auth.uid())
      and p.ativo
      and t.modulo_id = p_modulo_id
      and current_date >= t.data_inicio
      and (t.data_fim is null or current_date <= t.data_fim)
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.participante_atual_id() to authenticated;
grant execute on function private.pode_acessar_modulo(bigint) to authenticated;

create or replace function public.validar_frequencia_matricula()
returns trigger language plpgsql set search_path = '' as $$
declare v_turma bigint;
begin
  select turma_id into v_turma from public.encontros where id = new.encontro_id;
  if not exists (
    select 1 from public.matriculas
    where turma_id = v_turma and participante_id = new.participante_id
      and status in ('ativa','concluida')
  ) then
    raise exception 'Participante não está matriculado nesta turma';
  end if;
  return new;
end;
$$;

create trigger frequencia_exige_matricula
before insert or update on public.frequencias
for each row execute function public.validar_frequencia_matricula();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger touch_modulos before update on public.modulos for each row execute function public.touch_updated_at();
create trigger touch_turmas before update on public.turmas for each row execute function public.touch_updated_at();
create trigger touch_participantes before update on public.participantes for each row execute function public.touch_updated_at();
create trigger touch_matriculas before update on public.matriculas for each row execute function public.touch_updated_at();
create trigger touch_encontros before update on public.encontros for each row execute function public.touch_updated_at();
create trigger touch_conteudos before update on public.conteudos_modulo for each row execute function public.touch_updated_at();

alter table public.modulos enable row level security;
alter table public.turmas enable row level security;
alter table public.participantes enable row level security;
alter table public.matriculas enable row level security;
alter table public.encontros enable row level security;
alter table public.frequencias enable row level security;
alter table public.papeis_usuario enable row level security;
alter table public.conteudos_modulo enable row level security;

create policy modulos_publicos on public.modulos for select to anon, authenticated using (ativo);
create policy modulos_admin on public.modulos for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy turmas_do_aluno on public.turmas for select to authenticated using (
  (select private.is_admin()) or id in (
    select turma_id from public.matriculas where participante_id = (select private.participante_atual_id())
  )
);
create policy turmas_admin on public.turmas for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy participante_proprio on public.participantes for select to authenticated using (
  auth_user_id = (select auth.uid()) or (select private.is_admin())
);
create policy participantes_admin on public.participantes for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy matriculas_do_aluno on public.matriculas for select to authenticated using (
  participante_id = (select private.participante_atual_id()) or (select private.is_admin())
);
create policy matriculas_admin on public.matriculas for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy encontros_do_aluno on public.encontros for select to authenticated using (
  (select private.is_admin()) or turma_id in (
    select turma_id from public.matriculas where participante_id = (select private.participante_atual_id()) and status in ('ativa','concluida')
  )
);
create policy encontros_admin on public.encontros for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy frequencia_propria on public.frequencias for select to authenticated using (
  participante_id = (select private.participante_atual_id()) or (select private.is_admin())
);
create policy frequencias_admin on public.frequencias for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy papel_proprio on public.papeis_usuario for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy papeis_admin on public.papeis_usuario for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy conteudo_por_matricula on public.conteudos_modulo for select to authenticated using (
  publicado and (select private.pode_acessar_modulo(modulo_id))
);
create policy conteudos_admin on public.conteudos_modulo for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.modulos to anon;
grant select on public.modulos, public.turmas, public.participantes, public.matriculas, public.encontros, public.frequencias, public.papeis_usuario, public.conteudos_modulo to authenticated;
grant insert, update, delete on public.modulos, public.turmas, public.participantes, public.matriculas, public.encontros, public.frequencias, public.papeis_usuario, public.conteudos_modulo to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets (id, name, public)
values ('conteudos-modulos', 'conteudos-modulos', false)
on conflict (id) do update set public = false;

create policy storage_conteudo_matricula on storage.objects for select to authenticated using (
  bucket_id = 'conteudos-modulos'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and (select private.pode_acessar_modulo(((storage.foldername(name))[1])::bigint))
);
create policy storage_conteudo_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'conteudos-modulos' and (select private.is_admin())
);
create policy storage_conteudo_admin_update on storage.objects for update to authenticated using (
  bucket_id = 'conteudos-modulos' and (select private.is_admin())
) with check (bucket_id = 'conteudos-modulos' and (select private.is_admin()));
create policy storage_conteudo_admin_delete on storage.objects for delete to authenticated using (
  bucket_id = 'conteudos-modulos' and (select private.is_admin())
);

-- Após criar o primeiro usuário no Auth, promova-o manualmente uma única vez:
-- insert into public.papeis_usuario(user_id, papel) values ('UUID_DO_USUARIO', 'administrador');
