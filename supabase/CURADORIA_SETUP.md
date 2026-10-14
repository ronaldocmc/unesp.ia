# Usuários da curadoria do Observar.IA

## Ativação pelo Supabase Web

1. No SQL Editor, abra uma nova consulta e cole **todo o conteúdo** de `migrations/202610140001_observatorio_curadores.sql`. Não cole somente o nome do arquivo. Execute a consulta.
2. Em Edge Functions, crie a função **observatorio-curadores**. Cole todo o conteúdo de `functions/observatorio-curadores/index.ts` como arquivo `index.ts` e publique. O arquivo é único, sem arquivos auxiliares.
3. Nas configurações dessa função, deixe **Verify JWT with legacy secret** desligado e salve. A própria função valida o JWT por `Auth.getUser()` e exige o papel `administrador` ou `observatorio_admin` antes de enviar qualquer convite.
4. Em Authentication → URL Configuration, adicione às Redirect URLs: `https://ia.fct.unesp.br/redefinir-senha.html?returnTo=administracao-observatorio.html`. Preserve as outras URLs existentes. O Site URL pode permanecer como está; o convite usa explicitamente o endereço acima.
5. Configure o envio por SMTP em Authentication para entregar convites aos e-mails da equipe. O serviço padrão do Supabase envia apenas a endereços pertencentes à equipe do projeto. Veja a [documentação de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
6. Entre no painel do Observatório com uma conta `administrador` ou `observatorio_admin` e abra **Usuários da curadoria**.
7. Em **Cadastrar novo curador**, preencha nome e e-mail e clique em **Cadastrar e enviar convite**. A conta é criada no Supabase Auth e recebe exclusivamente o perfil `observatorio_curador`.
8. O curador abre o convite, define sua própria senha e é encaminhado ao login do painel do Observatório. Ele não precisa ser cadastrado como participante do curso.

A página de gestão é `curadoria-usuarios.html`. As alterações dos arquivos do site também precisam ser publicadas no servidor. O deploy do site não publica Edge Functions nem aplica migrations no Supabase.

Para contas que já existem, abra **Liberar acesso para conta existente**, informe o e-mail e libere a curadoria. Contas com outro perfil não são sobrescritas. Se o e-mail foi enviado mas a concessão falhou, conclua a liberação usando essa opção; a mensagem da função informa a situação parcial.

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas pelo ambiente do Supabase. A chave de serviço permanece somente na função; não copie seu valor para o site. `CURADORIA_SITE_URL` é opcional para outro domínio, por exemplo `https://ronaldocmc.github.io/unesp.ia/`. A Redirect URL correspondente também deve ser cadastrada.

## Permissões

| Perfil | Publicações | Categorias, veículos e downloads | Usuários da curadoria | Administração do portal |
| --- | --- | --- | --- | --- |
| `administrador` | Todas as ações | Todas as ações | Cadastrar, convidar, liberar e remover acesso | Sim |
| `observatorio_admin` | Todas as ações | Todas as ações | Cadastrar, convidar, liberar e remover acesso | Não |
| `observatorio_curador` | Ler, cadastrar, editar, revisar, publicar e arquivar | Apenas leitura de opções públicas usadas no formulário | Não | Não |

Curadores não podem excluir permanentemente registros. Para retirar uma publicação, devem mudar sua situação para `arquivado`. As permissões são verificadas tanto no painel quanto pelas políticas RLS do banco.

É possível cadastrar vários curadores: cada linha em `papeis_usuario` corresponde a uma conta diferente. O modelo atual admite um perfil por conta. A concessão de curadoria rejeita contas que já tenham outro perfil, evitando substituir permissões de administradores ou instrutores.

**Remover acesso** apaga somente o perfil `observatorio_curador`. A conta de autenticação e as publicações são preservadas. A remoção passa a valer no banco mesmo se a pessoa já estiver conectada.

## Conferência após ativar

- Administrador: consegue listar curadores, liberar uma conta existente por e-mail e remover seu acesso.
- Cadastro de novo curador: a conta aparece em Authentication e na lista de curadores; o convite leva à definição de senha e depois ao login do Observar.IA.
- Curador: acessa somente publicações no painel; pode publicar após revisão humana e arquivar, sem opções de exclusão ou gestão de usuários.
- Conta sem perfil: recebe acesso negado ao painel e às funções de gestão de curadores.
- Curador tentando diretamente as funções de gestão: recebe erro de permissão do banco.
- Após revogar curadoria: a conta continua existindo, mas perde a edição das publicações.
