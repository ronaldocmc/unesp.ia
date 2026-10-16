begin;
alter table public.observatorio_conteudos add column if not exists relevancia_ia integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.observatorio_conteudos'::regclass and conname = 'observatorio_relevancia_ia_check') then
    alter table public.observatorio_conteudos add constraint observatorio_relevancia_ia_check check (relevancia_ia between 0 and 100);
  end if;
end $$;
comment on column public.observatorio_conteudos.relevancia_ia is
'Pertinência temática heurística (0–100), não confiança/veracidade. 80+ alta; 60+ relevante; 40+ revisar; demais baixa. NULL = não avaliado.';
-- Sem coluna de classificação redundante: calculada pelo Radar. Gemini permanece NULL.
grant select, insert on public.observatorio_conteudos to service_role;
grant usage, select on sequence public.observatorio_conteudos_id_seq to service_role;
notify pgrst, 'reload schema';
commit;
