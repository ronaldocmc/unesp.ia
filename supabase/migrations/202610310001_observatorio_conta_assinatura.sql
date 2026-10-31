-- Conta única: identidade no Supabase Auth; preferências privadas, sem disparar e-mails.
begin;
create table if not exists private.observatorio_interessados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 2 and 120),
  assinatura boolean not null default false,
  consentimento_versao text,
  inscrito_em timestamptz,
  cancelado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table if not exists private.observatorio_assinatura_eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  assinatura boolean not null,
  versao text not null,
  registrado_em timestamptz not null default now()
);
alter table private.observatorio_interessados enable row level security;
alter table private.observatorio_assinatura_eventos enable row level security;
revoke all on private.observatorio_interessados,private.observatorio_assinatura_eventos from public,anon,authenticated;

create or replace function public.observatorio_minha_conta()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; p private.observatorio_interessados;
begin
  select * into u from auth.users where id=auth.uid();
  if u.id is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  select * into p from private.observatorio_interessados where user_id=u.id;
  return jsonb_build_object('nome',coalesce(p.nome,left(coalesce(u.raw_user_meta_data->>'nome',u.raw_user_meta_data->>'full_name',''),120)),
    'email',u.email,'email_confirmado',u.email_confirmed_at is not null,'assinatura',coalesce(p.assinatura,false),
    'inscrito_em',p.inscrito_em,'cancelado_em',p.cancelado_em);
end $$;

create or replace function public.observatorio_salvar_conta(p_nome text,p_assinatura boolean,p_consentimento text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; anterior boolean; existe boolean;
begin
  select * into u from auth.users where id=auth.uid();
  if u.id is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  if p_nome is null or length(btrim(p_nome)) not between 2 and 120 or p_assinatura is null then
    raise exception 'Informe nome entre 2 e 120 caracteres e a preferência de assinatura.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(u.id::text,310001));
  select assinatura into anterior from private.observatorio_interessados where user_id=u.id;
  existe:=found;
  if p_assinatura and (u.email_confirmed_at is null or nullif(u.email,'') is null) then
    raise exception 'Confirme seu e-mail antes de assinar o Observar.Dia.';
  end if;
  if p_assinatura and not coalesce(anterior,false) and p_consentimento is distinct from 'observar-dia-20261031' then
    raise exception 'Confirme que deseja receber o Observar.Dia.';
  end if;
  insert into private.observatorio_interessados(user_id,nome,assinatura,consentimento_versao,inscrito_em,cancelado_em)
    values(u.id,btrim(p_nome),p_assinatura,case when p_assinatura then 'observar-dia-20261031' end,
      case when p_assinatura then now() end,null)
  on conflict(user_id) do update set nome=excluded.nome,assinatura=excluded.assinatura,atualizado_em=now(),
    consentimento_versao=case when excluded.assinatura then 'observar-dia-20261031' else observatorio_interessados.consentimento_versao end,
    inscrito_em=case when excluded.assinatura and not observatorio_interessados.assinatura then now() else observatorio_interessados.inscrito_em end,
    cancelado_em=case when not excluded.assinatura and observatorio_interessados.assinatura then now() else observatorio_interessados.cancelado_em end;
  if (existe and anterior is distinct from p_assinatura) or (not existe and p_assinatura) then
    insert into private.observatorio_assinatura_eventos(user_id,assinatura,versao)
      values(u.id,p_assinatura,'observar-dia-20261031');
  end if;
  return public.observatorio_minha_conta();
end $$;

create or replace function public.observatorio_minhas_sugestoes(p_pagina integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare resultado jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  if p_pagina is null or p_pagina not between 1 and 100000 then raise exception 'Página inválida.'; end if;
  select jsonb_build_object('total',(select count(*) from public.observatorio_conteudos where submetido_por=auth.uid()),
    'itens',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id desc) from (
      select id,titulo,url,created_at,case when status='publicado' and revisao_humana then 'publicada'
        when status='arquivado' then 'nao_selecionada' else 'aguardando_revisao' end as situacao
      from public.observatorio_conteudos where submetido_por=auth.uid()
      order by created_at desc,id desc limit 20 offset (p_pagina-1)*20
    ) s),'[]'::jsonb)) into resultado;
  return resultado;
end $$;

-- Entrada única com identidade e estado editorial definidos no servidor.
create or replace function public.observatorio_enviar_sugestao(p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; v_id bigint; v_url text; v_imagem text; v_data date;
begin
  select * into u from auth.users where id=auth.uid();
  if u.id is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  if u.email_confirmed_at is null then raise exception 'Confirme seu e-mail antes de sugerir uma observação.'; end if;
  if p_dados is null or jsonb_typeof(p_dados)<>'object' or octet_length(p_dados::text)>12000 then raise exception 'Dados inválidos.'; end if;
  if length(btrim(coalesce(p_dados->>'titulo',''))) not between 3 and 300
    or length(btrim(coalesce(p_dados->>'resumo',''))) not between 3 and 1200
    or length(btrim(coalesce(p_dados->>'fonte',''))) not between 2 and 200
    or length(btrim(coalesce(p_dados->>'categoria',''))) not between 2 and 120
    or length(coalesce(p_dados->>'observacao_colaborador',''))>800
    or length(coalesce(p_dados->>'palavras_chave',''))>400 then raise exception 'Confira título, resumo, fonte, categoria e limites de texto.'; end if;
  if coalesce(p_dados->>'tipo','') not in ('Notícia monitorada','Notícia institucional','Pesquisa','Tecnologia','Análise',
    'Artigo científico','Tese ou dissertação','Política ou regulação','Indicador','Portal','Vídeo') then raise exception 'Tipo de conteúdo inválido.'; end if;
  v_url:=btrim(p_dados->>'url'); v_imagem:=nullif(btrim(p_dados->>'imagem_url'),'');
  if v_url is null or length(v_url)>2048 or v_url !~* '^https?://[a-z0-9][a-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$'
    or (v_imagem is not null and (length(v_imagem)>2048 or v_imagem !~* '^https?://[a-z0-9][a-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$')) then
    raise exception 'Informe links HTTP ou HTTPS válidos, sem credenciais.';
  end if;
  v_data:=(p_dados->>'data_publicacao')::date;
  if v_data is null or not isfinite(v_data) then raise exception 'Informe a data de publicação.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u.id::text,310002));
  select id into v_id from public.observatorio_conteudos where submetido_por=u.id and url=v_url order by id limit 1;
  if found then return jsonb_build_object('id',v_id,'duplicada',true); end if;
  if (select count(*) from public.observatorio_conteudos where submetido_por=u.id
      and created_at>=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')>=10 then
    raise exception 'Limite de 10 sugestões por dia atingido. Tente em outro dia.';
  end if;
  insert into public.observatorio_conteudos(colecao,tipo,categoria,titulo,resumo,data_publicacao,url,imagem_url,palavras_chave,fonte,
    observacao_colaborador,origem,status,destaque,revisao_humana,aprovado_curadoria,submetido_por,submetido_email)
  values('Observatório',p_dados->>'tipo',btrim(p_dados->>'categoria'),btrim(p_dados->>'titulo'),btrim(p_dados->>'resumo'),v_data,v_url,v_imagem,
    nullif(btrim(p_dados->>'palavras_chave'),''),btrim(p_dados->>'fonte'),nullif(btrim(p_dados->>'observacao_colaborador'),''),
    'Usuário identificado','revisao',false,false,false,u.id,u.email) returning id into v_id;
  return jsonb_build_object('id',v_id,'duplicada',false);
end $$;
drop policy if exists observatorio_colaborador_insert on public.observatorio_conteudos;
create index if not exists observatorio_submetido_data_idx on public.observatorio_conteudos(submetido_por,created_at desc);

create or replace function public.observatorio_interessados_listar(p_situacao text default '',p_busca text default '',p_pagina integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare resultado jsonb;
begin
  if not coalesce(private.is_observatorio_admin(),false) then raise exception 'Restrito à administração.' using errcode='42501'; end if;
  if p_situacao is null or p_situacao not in ('','inscrito','cancelado','nao_inscrito','pendente')
    or p_busca is null or length(p_busca)>200 or p_pagina is null or p_pagina not between 1 and 100000 then raise exception 'Filtros inválidos.'; end if;
  with base as (
    select p.nome,u.email,p.criado_em,p.atualizado_em,p.inscrito_em,p.cancelado_em,
      case when u.email_confirmed_at is null then 'pendente' when p.assinatura then 'inscrito'
        when p.cancelado_em is not null then 'cancelado' else 'nao_inscrito' end as situacao
    from private.observatorio_interessados p join auth.users u on u.id=p.user_id
  ), filtrados as materialized (
    select * from base where (p_situacao='' or situacao=p_situacao)
      and (p_busca='' or strpos(lower(nome||' '||coalesce(email,'')),lower(p_busca))>0)
  ) select jsonb_build_object('total',(select count(*) from filtrados),
    'itens',coalesce((select jsonb_agg(to_jsonb(s) order by s.criado_em desc,s.email) from (
      select * from filtrados order by criado_em desc,email limit 25 offset (p_pagina-1)*25
    ) s),'[]'::jsonb)) into resultado;
  return resultado;
end $$;

revoke all on function public.observatorio_minha_conta(),public.observatorio_salvar_conta(text,boolean,text),
  public.observatorio_minhas_sugestoes(integer),public.observatorio_enviar_sugestao(jsonb),
  public.observatorio_interessados_listar(text,text,integer) from public,anon;
grant execute on function public.observatorio_minha_conta(),public.observatorio_salvar_conta(text,boolean,text),
  public.observatorio_minhas_sugestoes(integer),public.observatorio_enviar_sugestao(jsonb),
  public.observatorio_interessados_listar(text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
