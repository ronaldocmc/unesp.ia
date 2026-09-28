-- Eixos e iniciativas editáveis do ecossistema unesp.IA.
create table if not exists public.ecossistema_eixos (
  id text primary key check (id in ('aprender','experimentar','pesquisa','inovacao')),
  ordem integer not null,
  nome text not null,
  rotulo text not null,
  descricao text not null,
  destaques text,
  acao_rotulo text not null,
  acao_url text not null,
  acao_externa boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho','revisao','publicado','arquivado')),
  revisao_humana boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecossistema_iniciativas (
  id bigint generated always as identity primary key,
  eixo text not null references public.ecossistema_eixos(id) on update cascade on delete restrict,
  tipo text not null default 'Iniciativa',
  nome text not null,
  descricao text not null,
  url text,
  externo boolean not null default false,
  ordem integer not null default 0,
  destaque boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho','revisao','publicado','arquivado')),
  revisao_humana boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ecossistema_eixos_publicacao_idx
  on public.ecossistema_eixos(status, ordem);
create index if not exists ecossistema_iniciativas_publicacao_idx
  on public.ecossistema_iniciativas(eixo, status, ordem);

drop trigger if exists touch_ecossistema_eixos on public.ecossistema_eixos;
create trigger touch_ecossistema_eixos before update on public.ecossistema_eixos
for each row execute function public.touch_updated_at();

drop trigger if exists touch_ecossistema_iniciativas on public.ecossistema_iniciativas;
create trigger touch_ecossistema_iniciativas before update on public.ecossistema_iniciativas
for each row execute function public.touch_updated_at();

alter table public.ecossistema_eixos enable row level security;
alter table public.ecossistema_iniciativas enable row level security;

drop policy if exists ecossistema_eixos_publico on public.ecossistema_eixos;
create policy ecossistema_eixos_publico on public.ecossistema_eixos
for select to anon using (status = 'publicado' and revisao_humana = true);
drop policy if exists ecossistema_eixos_admin on public.ecossistema_eixos;
create policy ecossistema_eixos_admin on public.ecossistema_eixos
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists ecossistema_iniciativas_publico on public.ecossistema_iniciativas;
create policy ecossistema_iniciativas_publico on public.ecossistema_iniciativas
for select to anon using (status = 'publicado' and revisao_humana = true);
drop policy if exists ecossistema_iniciativas_admin on public.ecossistema_iniciativas;
create policy ecossistema_iniciativas_admin on public.ecossistema_iniciativas
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.ecossistema_eixos, public.ecossistema_iniciativas to anon, authenticated;
grant insert, update, delete on public.ecossistema_eixos, public.ecossistema_iniciativas to authenticated;
grant usage, select on sequence public.ecossistema_iniciativas_id_seq to authenticated;

insert into public.ecossistema_eixos
  (id,ordem,nome,rotulo,descricao,destaques,acao_rotulo,acao_url,acao_externa,status,revisao_humana)
values
  ('aprender',1,'Aprender.IA','Formação','Formação em Ciência de Dados e Inteligência Artificial para diferentes públicos, combinando compreensão, experimentação, aplicação e criação.','Cursos e oficinas, Trilhas de aprendizagem, Materiais educacionais, Extensão universitária','Conhecer as formações','modulos.html',false,'publicado',true),
  ('experimentar',2,'Experimentar.IA','Aprender fazendo','Ambientes interativos para experimentar Inteligência Artificial, compreender seu funcionamento e desenvolver competências por meio da prática.','Aprende.IA, Conversa.IA, Enxerga.IA, Escuta.IA, Decide.IA, Explica.IA, Agente.IA','Experimentar no laboratório','https://unesp-ia-laboratorio-ml.ronaldocorreia.chatgpt.site/?lab=aplicacoes',true,'publicado',true),
  ('pesquisa',3,'Pesquisar.IA','Research & Innovation Lab','Pesquisa, desenvolvimento e inovação científica em Ciência de Dados e Inteligência Artificial.','Linhas de pesquisa, Projetos estruturantes, Pós-graduação e IC, Produção científica','Acessar Pesquisar.IA','pesquisa.html',false,'publicado',true),
  ('inovacao',4,'Inovar.IA','Da pesquisa à aplicação','Ciência de Dados e Inteligência Artificial transformadas em produtos, processos e serviços para a sociedade e para as organizações.','Pescar.IA, pet.IA, paranapanema.IA, Metodologia APLICAR.IA','Conhecer as iniciativas','#inovacao-iniciativas',false,'publicado',true)
on conflict (id) do nothing;

insert into public.ecossistema_iniciativas
  (eixo,tipo,nome,descricao,url,externo,ordem,status,revisao_humana)
select seed.* from (values
  ('aprender','Formação','unesp.IA - Inteligência Artificial para Todos','Formação modular, aberta e progressiva.','modulos.html',false,1,'publicado',true),
  ('aprender','Formação','unesp.IA Melhor Idade','Formação acessível para pessoas idosas.','inscricoes.html',false,2,'publicado',true),
  ('aprender','Formação','Capacitações profissionais','Espaço preparado para novas ofertas e públicos.','inscricoes.html',false,3,'publicado',true),
  ('experimentar','Laboratório','Ambientes interativos','Experimentos orientados para diferentes capacidades da IA.',null,false,1,'publicado',true),
  ('experimentar','Agente','Agente.IA','Criação, teste e uso supervisionado de agentes inteligentes.',null,false,2,'publicado',true),
  ('experimentar','Laboratório','unesp.IA Lab','Aplicações educativas, jogos e desafios práticos.','https://unesp-ia-laboratorio-ml.ronaldocorreia.chatgpt.site/?lab=aplicacoes',true,3,'publicado',true),
  ('pesquisa','Projeto','UnespDataLens','Engenharia de Dados Analíticos confiável e rastreável.',null,false,1,'publicado',true),
  ('pesquisa','Projeto','EdmLens DataFlow','Engenharia e Mineração de Dados Educacionais.',null,false,2,'publicado',true),
  ('pesquisa','Projeto','MIL@-eDU','Análise orientada à decisão em contextos educacionais.',null,false,3,'publicado',true),
  ('inovacao','Aplicação','Aplicações','Pescar.IA, pet.IA, paranapanema.IA e novas soluções.',null,false,1,'publicado',true),
  ('inovacao','Metodologia','Metodologia APLICAR.IA','Adoção estruturada de IA por empresas, prefeituras e organizações.',null,false,2,'publicado',true),
  ('inovacao','Metodologia','Escada de maturidade','Manual → Prompt → Copiloto → Processo → Automação → Agente.',null,false,3,'publicado',true)
) as seed(eixo,tipo,nome,descricao,url,externo,ordem,status,revisao_humana)
where not exists (select 1 from public.ecossistema_iniciativas);
