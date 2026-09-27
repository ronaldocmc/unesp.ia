-- Conteúdos públicos do Observar.IA e matérias do unesp.IA na mídia.
create table if not exists public.observatorio_conteudos (
  id bigint generated always as identity primary key,
  colecao text not null check (colecao in ('Observatório','unesp.IA na mídia')),
  tipo text not null,
  categoria text not null,
  titulo text not null,
  resumo text not null,
  projeto_relacionado text,
  veiculo text,
  data_publicacao date not null,
  url text not null,
  video_url text,
  imagem_url text,
  participantes text,
  cidade text,
  abrangencia text,
  palavras_chave text,
  fonte text not null,
  origem text not null default 'Cadastro manual',
  status text not null default 'rascunho' check (status in ('rascunho','revisao','publicado','arquivado')),
  destaque boolean not null default false,
  revisao_humana boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists observatorio_publicacao_idx
  on public.observatorio_conteudos(status, data_publicacao desc);
create index if not exists observatorio_colecao_idx
  on public.observatorio_conteudos(colecao, projeto_relacionado);

drop trigger if exists touch_observatorio_conteudos on public.observatorio_conteudos;
create trigger touch_observatorio_conteudos before update on public.observatorio_conteudos
for each row execute function public.touch_updated_at();

alter table public.observatorio_conteudos enable row level security;

drop policy if exists observatorio_publico on public.observatorio_conteudos;
create policy observatorio_publico on public.observatorio_conteudos
for select to anon using (status = 'publicado' and revisao_humana = true);

drop policy if exists observatorio_admin on public.observatorio_conteudos;
create policy observatorio_admin on public.observatorio_conteudos
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.observatorio_conteudos to anon, authenticated;
grant insert, update, delete on public.observatorio_conteudos to authenticated;
grant usage, select on sequence public.observatorio_conteudos_id_seq to authenticated;
