-- Execute antes de atualizar observatorio-radar. Não altera conteúdos existentes.
begin;
create table if not exists public.observatorio_feeds (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null check (codigo ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  nome text not null check (length(trim(nome)) between 1 and 200),
  url_feed text unique not null check (url_feed ~ '^https://[^[:space:]]+$' and length(url_feed) <= 2048),
  instituicao text,
  categoria text not null check (categoria in ('pesquisa','noticia','aplicacao','regulacao')),
  escopo text not null check (escopo in ('ia','tecnologia','geral')),
  idioma text, pais text,
  prioridade integer not null default 2 check (prioridade between 1 and 3),
  ativo boolean not null default true,
  ultima_execucao timestamptz,
  ultimo_status text check (ultimo_status in ('ok','erro')),
  ultimo_erro text,
  quantidade_lida integer not null default 0 check (quantidade_lida >= 0),
  quantidade_relevante integer not null default 0 check (quantidade_relevante >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists observatorio_feeds_ativos_idx on public.observatorio_feeds(prioridade,nome) where ativo;

create or replace function private.observatorio_feed_atualizado()
returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em = now(); return new; end;
$$;
revoke all on function private.observatorio_feed_atualizado() from public, anon, authenticated;
drop trigger if exists observatorio_feed_atualizado on public.observatorio_feeds;
create trigger observatorio_feed_atualizado before update on public.observatorio_feeds
for each row execute function private.observatorio_feed_atualizado();

alter table public.observatorio_feeds enable row level security;
revoke all on public.observatorio_feeds from public, anon, authenticated;
grant select, insert, update, delete on public.observatorio_feeds to authenticated;
grant select, update on public.observatorio_feeds to service_role;
-- Administradores podem cadastrar/editar; curadores consultam somente fontes ativas.
drop policy if exists observatorio_feeds_admin on public.observatorio_feeds;
create policy observatorio_feeds_admin on public.observatorio_feeds for all to authenticated
using ((select private.is_observatorio_admin())) with check ((select private.is_observatorio_admin()));
drop policy if exists observatorio_feeds_curador on public.observatorio_feeds;
create policy observatorio_feeds_curador on public.observatorio_feeds for select to authenticated
using (ativo and (select private.is_observatorio_curador()));

-- Preserva todas as 24 fontes anteriores. Reexecução não sobrescreve edições administrativas.
insert into public.observatorio_feeds
(codigo,nome,url_feed,instituicao,categoria,escopo,idioma,pais,prioridade,ativo) values
('hugging-face','Hugging Face','https://huggingface.co/blog/feed.xml','Hugging Face','pesquisa','ia','en','US',1,true),
('google-ai','Google AI','https://blog.google/technology/ai/rss/','Google','pesquisa','ia','en','US',1,true),
('openai-news','OpenAI','https://openai.com/news/rss.xml','OpenAI','pesquisa','ia','en','US',1,true),
('mit-news','MIT News','https://news.mit.edu/rss/topic/artificial-intelligence','MIT','pesquisa','ia','en','US',1,true),
('bair','BAIR (Berkeley)','https://bair.berkeley.edu/blog/feed.xml','UC Berkeley','pesquisa','ia','en','US',1,true),
('anthropic-news','Anthropic News','https://www.anthropic.com/feed.xml','Anthropic','pesquisa','ia','en','US',1,true),
('anthropic-engineering','Anthropic Engineering','https://www.anthropic.com/engineering/feed.xml','Anthropic','pesquisa','ia','en','US',1,true),
('deepseek','DeepSeek Releases','https://github.com/deepseek-ai.atom','DeepSeek','pesquisa','ia','en','CN',1,true),
('techcrunch-ai','TechCrunch','https://techcrunch.com/category/artificial-intelligence/feed/','TechCrunch','noticia','ia','en','US',2,true),
('the-verge-ai','The Verge','https://www.theverge.com/rss/ai-artificial-intelligence/index.xml','The Verge','noticia','ia','en','US',2,true),
('venturebeat-ai','VentureBeat','https://venturebeat.com/category/ai/feed/','VentureBeat','noticia','ia','en','US',2,true),
('ars-technica','Ars Technica','https://feeds.arstechnica.com/arstechnica/technology-lab','Ars Technica','noticia','tecnologia','en','US',2,true),
('mit-tech-review','MIT Tech Review','https://www.technologyreview.com/topic/artificial-intelligence/feed/','MIT Technology Review','noticia','ia','en','US',2,true),
('simon-willison','Simon Willison','https://simonwillison.net/atom/everything/','Simon Willison','aplicacao','tecnologia','en',null,2,true),
('latent-space','Latent Space','https://www.latent.space/feed','Latent Space','aplicacao','ia','en',null,2,true),
('marktechpost','MarkTechPost','https://www.marktechpost.com/feed/','MarkTechPost','pesquisa','ia','en','US',2,true),
('tecnoblog','Tecnoblog','https://tecnoblog.net/feed/','Tecnoblog','noticia','tecnologia','pt-BR','BR',2,true),
('canaltech','Canaltech','https://canaltech.com.br/rss/','Canaltech','noticia','tecnologia','pt-BR','BR',2,true),
('g1-tecnologia','G1 Tecnologia','https://g1.globo.com/rss/g1/tecnologia/','Globo','noticia','tecnologia','pt-BR','BR',2,true),
('usp-observatorio','USP (Observatório)','https://jornal.usp.br/?s=observatorio&feed=rss2','USP','regulacao','geral','pt-BR','BR',2,true),
('usp-ia','USP (IA)','https://jornal.usp.br/tag/inteligencia-artificial/feed/','USP','pesquisa','ia','pt-BR','BR',1,true),
('unesp-observatorio','UNESP (Observatório)','https://jornal.unesp.br/?s=observatorio&feed=rss2','UNESP','regulacao','geral','pt-BR','BR',2,true),
('unesp-ia','UNESP (IA)','https://jornal.unesp.br/tag/inteligencia-artificial/feed/','UNESP','pesquisa','ia','pt-BR','BR',1,true),
('unicamp-observatorio','UNICAMP (Observatório)','https://www.unicamp.br/noticias/?s=observatorio&feed=rss2','UNICAMP','regulacao','geral','pt-BR','BR',2,true)
on conflict do nothing;
notify pgrst, 'reload schema';
commit;
