# Home unesp.IA Lab

A home segue a referência visual fornecida em 01/10/2026. Os textos, menus,
cartões e botões são HTML responsivo, não uma captura da página inteira.

- `assets/css/home-lab.css` mantém o novo layout isolado do curso e do Observatório.
- `assets/img/ecossistema/referencia-home-lab.png` é o anexo original, sem alteração.
  As janelas CSS `.lab-crop` exibem apenas o logo, a ilustração principal e as três fotos.
  Os limites de cada janela são definidos em pixels da referência por `--crop-x/y/w/h`.
- Os quatro eixos continuam consultando JSON local e os conteúdos publicados no Supabase.
  O modo compacto preserva os cartões HTML em caso de falha de rede e não remove
  Aplicar.IA nem Agentes. Descrições/ações modificadas no painel substituem as sínteses locais.
- O chat do Observatório permanece marcado como recurso em desenvolvimento.
- `node --test tests/home-lab.test.cjs tests/observatorio.test.cjs` valida estrutura e links.
