alter table if exists public.observatorio_conteudos
  add column if not exists aprovado_curadoria boolean not null default false,
  add column if not exists agente_origem text,
  add column if not exists agente_processado_em timestamptz;

create index if not exists observatorio_radar_curadoria_idx
  on public.observatorio_conteudos(origem, aprovado_curadoria, status, updated_at desc);

create index if not exists observatorio_url_idx
  on public.observatorio_conteudos(url);
