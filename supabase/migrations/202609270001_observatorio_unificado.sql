-- Compatibilidade para instalações que aplicaram a primeira versão do Observatório.
alter table if exists public.observatorio_conteudos
  drop constraint if exists observatorio_conteudos_colecao_check;

update public.observatorio_conteudos
set colecao = 'Observatório'
where colecao = 'Conteúdo monitorado';

alter table if exists public.observatorio_conteudos
  add constraint observatorio_conteudos_colecao_check
  check (colecao in ('Observatório','unesp.IA na mídia'));
