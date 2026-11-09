-- Executar em homologação após a migração, como proprietário. Não lê dados pessoais.
begin;
set local role anon;
do $$
begin
  if has_table_privilege(current_user,'public.observatorio_conteudos','SELECT')
     or has_column_privilege(current_user,'public.observatorio_conteudos','submetido_email','SELECT')
     or has_function_privilege(current_user,'public.observatorio_importador_reservar()','EXECUTE')
  then raise exception 'Acesso anônimo excessivo'; end if;
  perform titulo from public.observatorio_acervo_publico limit 1;
  if exists(select 1 from public.observatorio_acervo_publico where status<>'publicado' or revisao_humana is not true)
  then raise exception 'Acervo contém registro não público'; end if;
end $$;
reset role;
do $$
declare k text := 'teste:'||gen_random_uuid()::text;
begin
  if not private.observatorio_consumir_cota(k,1) then raise exception 'Reserva inicial recusada'; end if;
  if private.observatorio_consumir_cota(k,1) then raise exception 'Limite não aplicado'; end if;
end $$;
rollback;
