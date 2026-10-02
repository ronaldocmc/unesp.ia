# Publicações do Observatório — cadastro manual e por link

Acesso: https://ronaldocmc.github.io/unesp.ia/administracao.html?secao=observatorio_conteudos

Também disponível no rodapé do Observatório, em **Administrar publicações**. É necessário entrar com uma conta que já tenha o papel `administrador` na tabela `papeis_usuario`. A sessão do painel do Supabase não substitui o login do portal. Nenhuma conta ou permissão é criada automaticamente.

## Cadastrar uma matéria

1. Cole a URL pública HTTPS em **Cadastrar por link** e clique em **Buscar dados do link**.
2. Confira título, resumo, fonte, data e imagem. A importação lê metadados públicos; não usa agentes, não gera análise e não copia a matéria completa.
3. Ajuste tipo e categoria. Para matérias sobre nossos projetos, escolha a coleção **unesp.IA na mídia** e preencha veículo e projeto relacionado.
4. Mantenha `rascunho` para trabalhar no conteúdo. Para disponibilizá-lo no site, escolha `publicado` e marque **Revisão humana concluída**.
5. Clique em **Salvar**. O registro vai diretamente para o Supabase. Atualize a página do Observatório para consultar o conteúdo publicado; não é necessário novo commit ou deploy no GitHub.

Um link já cadastrado abre o registro existente. A verificação usa a URL sem fragmento e também o endereço final após redirecionamentos; URLs diferentes para a mesma matéria ainda podem exigir revisão manual. A listagem administrativa mostra até 1.000 registros mais recentemente atualizados.

Use **Novo cadastro** ou **Preencher manualmente** se a fonte bloquear a leitura, depender de JavaScript, não informar metadados, for um PDF/vídeo ou exigir login. A data ausente não é substituída pela data de hoje. Revise também os direitos de uso da imagem; ela pode ser removida ou substituída no cadastro.

## Segurança e implantação

- O painel mantém o login e as políticas RLS já existentes. Leitores anônimos só recebem registros publicados com revisão humana concluída.
- A função `observatorio-link` exige uma sessão válida e o papel de administrador. Ela retorna uma prévia, sem escrever no banco, sem chave de serviço e sem seguir instruções da página importada.
- Apenas páginas HTTPS públicas são aceitas; DNS e cada redirecionamento são validados contra redes privadas. A conexão usa o IP validado, com TLS normal, limite de tempo e tamanho. Não há envio de cookies ou credenciais do portal para a fonte.
- O cadastro usa a tabela e as migrações existentes do Observatório. Esta melhoria não exige nova migração nem habilita agentes. O agendamento de coleta de candidatos no GitHub foi pausado; o workflow foi preservado para uma futura execução manual.

Para reinstalar a função com a CLI oficial do Supabase:

```sh
supabase functions deploy observatorio-link --project-ref brdjzyutqdakabaolxiy
```

O projeto fornece `SUPABASE_URL` e `SUPABASE_ANON_KEY` à função. Mantenha a verificação JWT ativada; não coloque chaves secretas no JavaScript público. O código está em `supabase/functions/observatorio-link/`.

Testes locais:

```sh
node --test tests/observatorio-admin.test.mjs tests/observatorio.test.cjs tests/home-lab.test.cjs
```
