create table if not exists public.observatorio_categorias (
  id bigint generated always as identity primary key,
  nome text not null unique,
  descricao text,
  ordem integer not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observatorio_veiculos (
  id bigint generated always as identity primary key,
  nome text not null unique,
  tipo text not null default 'Portal',
  url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_observatorio_categorias on public.observatorio_categorias;
create trigger touch_observatorio_categorias before update on public.observatorio_categorias
for each row execute function public.touch_updated_at();

drop trigger if exists touch_observatorio_veiculos on public.observatorio_veiculos;
create trigger touch_observatorio_veiculos before update on public.observatorio_veiculos
for each row execute function public.touch_updated_at();

alter table public.observatorio_categorias enable row level security;
alter table public.observatorio_veiculos enable row level security;

drop policy if exists observatorio_categorias_publico on public.observatorio_categorias;
create policy observatorio_categorias_publico on public.observatorio_categorias
for select to anon, authenticated using (ativo = true or (select private.is_admin()));

drop policy if exists observatorio_categorias_admin on public.observatorio_categorias;
create policy observatorio_categorias_admin on public.observatorio_categorias
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists observatorio_veiculos_publico on public.observatorio_veiculos;
create policy observatorio_veiculos_publico on public.observatorio_veiculos
for select to anon, authenticated using (ativo = true or (select private.is_admin()));

drop policy if exists observatorio_veiculos_admin on public.observatorio_veiculos;
create policy observatorio_veiculos_admin on public.observatorio_veiculos
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.observatorio_categorias to anon, authenticated;
grant select on public.observatorio_veiculos to anon, authenticated;
grant insert, update, delete on public.observatorio_categorias to authenticated;
grant insert, update, delete on public.observatorio_veiculos to authenticated;
grant usage, select on sequence public.observatorio_categorias_id_seq to authenticated;
grant usage, select on sequence public.observatorio_veiculos_id_seq to authenticated;

insert into public.observatorio_categorias (nome, descricao, ordem) values
  ('Atualidades', 'Notícias e acontecimentos recentes relacionados a dados e IA.', 10),
  ('Pesquisa', 'Produção científica, estudos, relatórios e resultados de pesquisa.', 20),
  ('Tecnologia', 'Modelos, ferramentas, plataformas, agentes e aplicações tecnológicas.', 30),
  ('Regulação e governança', 'Normas, políticas públicas, ética, privacidade e governança.', 40),
  ('Educação e formação', 'Uso, ensino e formação em IA, dados e computação.', 50),
  ('Inovação e mercado', 'Empresas, startups, setor produtivo e inovação aplicada.', 60),
  ('Indicadores', 'Dados, métricas, rankings, benchmarks e séries históricas.', 70),
  ('Projetos unesp.IA', 'Projetos, ações e soluções vinculadas ao unesp.IA Lab.', 80)
on conflict (nome) do update set
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  ativo = true;

insert into public.observatorio_veiculos (nome, tipo, url) values
  ('Diário do Grande ABC', 'Jornal', 'https://www.dgabc.com.br'),
  ('Jornal Diário do Grande ABC', 'Jornal', 'https://www.dgabc.com.br'),
  ('O Globo', 'Jornal', 'https://oglobo.globo.com'),
  ('UOL', 'Portal', 'https://www.uol.com.br'),
  ('G1', 'Portal', 'https://g1.globo.com'),
  ('Agência FAPESP', 'Agência', 'https://agencia.fapesp.br'),
  ('UNESP', 'Instituição', 'https://www.unesp.br'),
  ('FCT/UNESP', 'Instituição', 'https://www.fct.unesp.br')
on conflict (nome) do update set
  tipo = excluded.tipo,
  url = excluded.url,
  ativo = true;
