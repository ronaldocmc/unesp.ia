-- Execute antes de atualizar a função e o painel. Preserva fontes e agendamentos.
begin;
alter table public.observatorio_feeds
  add column if not exists busca_manual boolean not null default true,
  add column if not exists busca_automatica boolean not null default true;
-- As permissões/RLS administrativas existentes continuam valendo.
-- Fonte inativa não participa de nenhuma modalidade, mesmo com opções marcadas.
notify pgrst, 'reload schema';
commit;
