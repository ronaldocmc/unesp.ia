insert into public.ecossistema_iniciativas
  (eixo, tipo, nome, descricao, url, imagem_url, externo, ordem, destaque, status, revisao_humana)
values
  (
    'inovacao',
    'Aplicação',
    'Paranapanema.IA',
    'Dados e IA conectados ao desenvolvimento regional.',
    'observatorio.html?busca=paranapanema.IA#acervo',
    'assets/img/ecossistema/iniciativas/paranapanema-ia.png',
    false,
    5,
    true,
    'publicado',
    true
  )
on conflict do nothing;

update public.ecossistema_iniciativas
set
  tipo = 'Aplicação',
  descricao = 'Dados e IA conectados ao desenvolvimento regional.',
  url = 'observatorio.html?busca=paranapanema.IA#acervo',
  imagem_url = 'assets/img/ecossistema/iniciativas/paranapanema-ia.png',
  externo = false,
  ordem = 5,
  destaque = true,
  status = 'publicado',
  revisao_humana = true
where eixo = 'inovacao'
  and lower(nome) = 'paranapanema.ia';
