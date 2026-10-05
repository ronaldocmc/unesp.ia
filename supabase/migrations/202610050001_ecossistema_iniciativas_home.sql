alter table public.ecossistema_iniciativas
  add column if not exists imagem_url text;

create index if not exists ecossistema_iniciativas_home_idx
  on public.ecossistema_iniciativas(eixo, destaque, status, ordem);

update public.ecossistema_iniciativas
set destaque = false
where eixo = 'inovacao'
  and nome in ('Aplicações', 'Metodologia APLICAR.IA', 'Escada de maturidade');

with seed(eixo, tipo, nome, descricao, url, imagem_url, externo, ordem, destaque, status, revisao_humana) as (
  values
    (
      'inovacao',
      'Aplicação',
      'Pescar.IA',
      'Dados, mapas e inteligência para apoiar a pesca responsável.',
      'observatorio.html?busca=Pescar.IA#acervo',
      'assets/img/ecossistema/iniciativas/pescar-ia.png',
      false,
      1,
      true,
      'publicado',
      true
    ),
    (
      'inovacao',
      'Aplicação',
      'pet.IA',
      'Tecnologia para apoiar o cuidado responsável com animais.',
      'observatorio.html?busca=pet.IA#acervo',
      'assets/img/ecossistema/iniciativas/pet-ia.png',
      false,
      2,
      true,
      'publicado',
      true
    ),
    (
      'inovacao',
      'Aplicação',
      'paranapanema.IA',
      'Dados e IA conectados ao desenvolvimento regional.',
      'observatorio.html?busca=paranapanema.IA#acervo',
      'assets/img/ecossistema/iniciativas/paranapanema-ia.png',
      false,
      3,
      true,
      'publicado',
      true
    ),
    (
      'inovacao',
      'Aplicação',
      'Outras iniciativas',
      'Novos projetos e aplicações em desenvolvimento.',
      'pesquisa.html',
      null,
      false,
      4,
      true,
      'publicado',
      true
    )
)
insert into public.ecossistema_iniciativas
  (eixo, tipo, nome, descricao, url, imagem_url, externo, ordem, destaque, status, revisao_humana)
select seed.eixo, seed.tipo, seed.nome, seed.descricao, seed.url, seed.imagem_url, seed.externo, seed.ordem, seed.destaque, seed.status, seed.revisao_humana
from seed
where not exists (
  select 1
  from public.ecossistema_iniciativas existing
  where existing.eixo = seed.eixo
    and existing.nome = seed.nome
);

update public.ecossistema_iniciativas existing
set
  tipo = seed.tipo,
  descricao = seed.descricao,
  url = seed.url,
  imagem_url = seed.imagem_url,
  externo = seed.externo,
  ordem = seed.ordem,
  destaque = seed.destaque,
  status = seed.status,
  revisao_humana = seed.revisao_humana
from (
  values
    ('inovacao', 'Pescar.IA', 'Aplicação', 'Dados, mapas e inteligência para apoiar a pesca responsável.', 'observatorio.html?busca=Pescar.IA#acervo', 'assets/img/ecossistema/iniciativas/pescar-ia.png', false, 1, true, 'publicado', true),
    ('inovacao', 'pet.IA', 'Aplicação', 'Tecnologia para apoiar o cuidado responsável com animais.', 'observatorio.html?busca=pet.IA#acervo', 'assets/img/ecossistema/iniciativas/pet-ia.png', false, 2, true, 'publicado', true),
    ('inovacao', 'paranapanema.IA', 'Aplicação', 'Dados e IA conectados ao desenvolvimento regional.', 'observatorio.html?busca=paranapanema.IA#acervo', 'assets/img/ecossistema/iniciativas/paranapanema-ia.png', false, 3, true, 'publicado', true),
    ('inovacao', 'Outras iniciativas', 'Aplicação', 'Novos projetos e aplicações em desenvolvimento.', 'pesquisa.html', null, false, 4, true, 'publicado', true)
) as seed(eixo, nome, tipo, descricao, url, imagem_url, externo, ordem, destaque, status, revisao_humana)
where existing.eixo = seed.eixo
  and existing.nome = seed.nome;
