# Usuários da curadoria do Observar.IA

## Ativação pelo Supabase Web

1. No SQL Editor, abra uma nova consulta e cole **todo o conteúdo** de `migrations/202610140001_observatorio_curadores.sql`. Não cole somente o nome do arquivo. Execute a consulta.
2. Em Authentication → Users, crie uma conta para cada curador, por convite ou e-mail e senha. Os curadores não precisam ser cadastrados como participantes do curso.
3. Entre no painel do Observatório com uma conta `administrador` ou `observatorio_admin` e abra **Usuários da curadoria**.
4. Informe o e-mail da conta criada e clique em **Liberar curadoria**. Repita para cada pessoa.
5. Cada curador entra em `login.html?returnTo=administracao-observatorio.html`, usando seu próprio e-mail e senha.

A página de gestão é `curadoria-usuarios.html`. As alterações dos arquivos do site também precisam ser publicadas no servidor. Esta implementação usa funções SQL no próprio banco, sem nova Edge Function.

## Permissões

| Perfil | Publicações | Categorias, veículos e downloads | Usuários da curadoria | Administração do portal |
| --- | --- | --- | --- | --- |
| `administrador` | Todas as ações | Todas as ações | Liberar e remover acesso | Sim |
| `observatorio_admin` | Todas as ações | Todas as ações | Liberar e remover acesso | Não |
| `observatorio_curador` | Ler, cadastrar, editar, revisar, publicar e arquivar | Apenas leitura de opções públicas usadas no formulário | Não | Não |

Curadores não podem excluir permanentemente registros. Para retirar uma publicação, devem mudar sua situação para `arquivado`. As permissões são verificadas tanto no painel quanto pelas políticas RLS do banco.

É possível cadastrar vários curadores: cada linha em `papeis_usuario` corresponde a uma conta diferente. O modelo atual admite um perfil por conta. A concessão de curadoria rejeita contas que já tenham outro perfil, evitando substituir permissões de administradores ou instrutores.

**Remover acesso** apaga somente o perfil `observatorio_curador`. A conta de autenticação e as publicações são preservadas. A remoção passa a valer no banco mesmo se a pessoa já estiver conectada.

## Conferência após ativar

- Administrador: consegue listar curadores, liberar uma conta existente por e-mail e remover seu acesso.
- Curador: acessa somente publicações no painel; pode publicar após revisão humana e arquivar, sem opções de exclusão ou gestão de usuários.
- Conta sem perfil: recebe acesso negado ao painel e às funções de gestão de curadores.
- Curador tentando diretamente as funções de gestão: recebe erro de permissão do banco.
- Após revogar curadoria: a conta continua existindo, mas perde a edição das publicações.
