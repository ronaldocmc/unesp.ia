# Portal Observar.IA

A página `observatorio.html` reaproveita os logos, o hero e os ícones existentes. Seus estilos ficam em `assets/css/observatorio.css`, sem alterar o curso nem os outros eixos.

## Conteúdo e destaques

- O acervo local continua em `assets/data/observatorio-conteudos.json`.
- Quando configurado, o Supabase acrescenta apenas registros com `status=publicado` e `revisao_humana=true`.
- A falha de uma fonte não bloqueia a outra. A fonte local é exibida sem esperar pela conexão remota.
- Uma única seção, **Explore o Observatório**, mostra o acervo: primeiro os conteúdos marcados como destaque, depois os demais; cada grupo é ordenado por data. Um selo identifica os destaques, sem duplicar cartões em outra seção.
- No painel existente, `destaque` controla a prioridade e `imagem_url` fornece a capa. Nenhuma migração nova é necessária para o layout.
- No JSON, os equivalentes são `destaque: true` e `imagem`. O campo opcional `areas` aceita Dados, Pesquisas, Avaliações, Regulação, Aplicações e Relatórios. Sem esse campo, a classificação usa tipo, categoria e palavras-chave.
- Quando não existe capa, o cartão usa uma ilustração vetorial temática. Não são inventadas notícias, números ou resultados para preencher a página.
- O acervo fica visível e os filtros atuam sobre a mesma lista. Notícias institucionais, notícias monitoradas e matérias na mídia continuam acessíveis pelo seletor de tipo. A busca inclui títulos, resumos, fontes, projetos e palavras-chave, sem diferenciar acentos.
- A chamada **Análises do Observar.IA**, entre o acervo e os agentes, destaca análises e sínteses da equipe e filtra o tipo editorial `Análise` no acervo. O cartão separado de Dados e Indicadores foi incorporado ao filtro Dados.
- A sequência é apresentação, Explore o Observatório, Análises do Observar.IA, agentes e Sobre. Metodologia, fontes, equipe e contato foram preservados. As âncoras antigas `#acervo`, `#destaques` e `#dados` continuam disponíveis; `#dados` seleciona o filtro correspondente.

## Funcionalidades futuras

Os seis agentes, a conversa em linguagem natural e os painéis interativos são apresentados como recursos em desenvolvimento. Os cartões explicam suas funções previstas; não iniciam agentes, não coletam dados e não publicam conteúdo automaticamente.

## Verificação

Execute `node --test tests/observatorio.test.cjs` e `node --check assets/js/observatorio.js`. Sirva a pasta por HTTP para conferir o portal; abrir diretamente por `file://` não permite carregar o JSON e os módulos corretamente.

Os testes cobrem o conteúdo preservado, destaques, classificação, busca, mídia, normalização dos registros remotos, URLs seguras, âncoras e assets. A validação visual deve incluir desktop e celular.
