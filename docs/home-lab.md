# Home unesp.IA Lab

A home segue a referência visual fornecida em 01/10/2026. Os textos, menus,
cartões e botões são HTML responsivo, não uma captura da página inteira.

- `assets/css/home-lab.css` mantém o novo layout isolado do curso e do Observatório.
- `assets/img/ecossistema/referencia-home-lab.png` é o anexo original, sem alteração.
  As janelas CSS `.lab-crop` exibem apenas as três fotos das iniciativas.
  Os limites de cada janela são definidos em pixels da referência por `--crop-x/y/w/h`.
- O cabeçalho usa o logo completo Research & Innovation Lab, igual ao Observatório,
  e o menu dos eixos. A abertura mostra somente a ilustração do novo anexo
  `referencia-home-ecossistema.png` (941 × 1672), preservado sem alterações.
  A janela CSS `.lab-hero-art` exibe a região x=400, y=51, largura=541, altura=442,
  com recuo na borda esquerda para ocultar os textos e botões da referência sem
  cortar o círculo ambiental. Não reproduz o menu ou os cartões. O tamanho é limitado para
  manter o equilíbrio com os textos HTML e o fundo claro.
- Os quatro eixos continuam consultando JSON local e os conteúdos publicados no Supabase.
  O modo compacto preserva os cartões HTML em caso de falha de rede e não remove
  Aplicar.IA nem Agentes. Descrições/ações modificadas no painel substituem as sínteses locais.
- O chat do Observatório permanece marcado como recurso em desenvolvimento.
- `node --test tests/home-lab.test.cjs tests/observatorio.test.cjs` valida estrutura e links.
