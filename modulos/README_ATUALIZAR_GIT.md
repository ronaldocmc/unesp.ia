# Atualização do GitHub Pages – UNESP.IA Módulo 12

Arquivos incluídos:

- `modulos/m12.html`: página completa do Módulo 12 — Automação Inteligente com n8n, Pipelines, Skills e LLMs.

## Como atualizar no repositório

1. Copie a pasta `modulos` deste pacote para a raiz do repositório do portal UNESP.IA.
2. Confirme que o arquivo ficou em:

   `modulos/m12.html`

3. Adicione o link para o módulo nas páginas necessárias, por exemplo em `index.html` e/ou `modulos.html`.

## Snippet sugerido para card do módulo

```html
<article class="module-card">
  <h3>12 Automação Inteligente com n8n, Pipelines, Skills e LLMs</h3>
  <p>Aprenda a criar workflows inteligentes com n8n, diferenciando workflow, pipeline, prompt, skill, tool, LLM, chatbot e agente.</p>
  <a href="modulos/m12.html">Acessar módulo</a>
</article>
```

## Comandos no GitHub Desktop

1. Abra o repositório no GitHub Desktop.
2. Copie/substitua os arquivos na pasta do repositório.
3. Verifique as alterações na aba Changes.
4. Escreva a mensagem de commit, por exemplo:

   `Adiciona módulo 12 de automação inteligente com n8n`

5. Clique em Commit to main.
6. Clique em Push origin.

## Comandos via terminal

```bash
git add modulos/m12.html index.html modulos.html
git commit -m "Adiciona módulo 12 de automação inteligente com n8n"
git push
```

Inclua `index.html` e `modulos.html` no commit somente se esses arquivos forem alterados para adicionar o link do Módulo 12.
