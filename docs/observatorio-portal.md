# Portal Observar.IA

A página `observatorio.html` reaproveita os logos, o hero e os ícones existentes. Seus estilos ficam em `assets/css/observatorio.css`, sem alterar o curso nem os outros eixos.

## Conteúdo e destaques

- O acervo local continua em `assets/data/observatorio-conteudos.json`.
- Quando configurado, o Supabase acrescenta apenas registros com `status=publicado` e `revisao_humana=true`.
- A falha de uma fonte não bloqueia a outra. A fonte local é exibida sem esperar pela conexão remota.
- A seção inicial mostra até cinco publicações: primeiro as marcadas como destaque, depois as mais recentes.
- No painel existente, `destaque` controla a prioridade e `imagem_url` fornece a capa. Nenhuma migração nova é necessária para o layout.
- No JSON, os equivalentes são `destaque: true` e `imagem`. O campo opcional `areas` aceita Dados, Pesquisas, Avaliações, Regulação, Aplicações e Relatórios. Sem esse campo, a classificação usa tipo, categoria e palavras-chave.
- Quando não existe capa, o cartão usa uma ilustração vetorial temática. Não são inventadas notícias, números ou resultados para preencher a página.
- Os filtros abrem o acervo completo. Notícias institucionais, notícias monitoradas e matérias na mídia continuam acessíveis pelo seletor de tipo. A busca inclui títulos, resumos, fontes, projetos e palavras-chave, sem diferenciar acentos.

## Funcionalidades futuras

Os seis agentes, a conversa em linguagem natural e os painéis interativos são apresentados como recursos em desenvolvimento. Os cartões explicam suas funções previstas; não iniciam agentes, não coletam dados e não publicam conteúdo automaticamente.

## Verificação

Execute `node --test tests/observatorio.test.cjs` e `node --check assets/js/observatorio.js`. Sirva a pasta por HTTP para conferir o portal; abrir diretamente por `file://` não permite carregar o JSON e os módulos corretamente.

Os testes cobrem o conteúdo preservado, destaques, classificação, busca, mídia, normalização dos registros remotos, URLs seguras, âncoras e assets. A validação visual deve incluir desktop e celular.
