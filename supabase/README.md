# Portal acadêmico unesp.IA com Supabase

Esta pasta contém o banco, as regras de acesso e a função administrativa do portal. A autorização real é feita no PostgreSQL por RLS: esconder links ou colocar senha em JavaScript não protege conteúdo.

## Implantação

1. Crie um projeto Supabase e aplique `migrations/202607130001_portal_academico.sql` pelo CLI ou SQL Editor.
2. Em `assets/js/portal/config.js`, informe a URL do projeto e a chave publicável (`anon`/publishable). Nunca use `service_role` no navegador.
3. Publique a função: `supabase functions deploy admin-users`.
4. Configure `SITE_URL` e as Redirect URLs de autenticação, incluindo `/redefinir-senha.html`.
5. Crie o primeiro usuário no Auth e promova-o no SQL Editor:

```sql
insert into public.papeis_usuario (user_id, papel)
select id, 'administrador' from auth.users where email = 'administrador@exemplo.br';
```

6. Entre em `/administracao.html`, cadastre módulos e turmas, importe/cadastre participantes e faça as matrículas.
7. Cadastre cada material em `conteudos_modulo`. Texto HTML curto pode ficar na coluna `html`; arquivos maiores devem ir ao bucket privado `conteudos-modulos`, no caminho `<id_modulo>/arquivo.html`, com esse caminho em `storage_path`.

## Regra crítica de publicação

Depois de migrar o conteúdo para `conteudos_modulo`, a implantação pública **não pode conter cópias completas** em `modulos/m*.html`, `materiais/` ou no histórico de um repositório público. As páginas públicas devem ser apenas catálogo/ementa e apontar para `area-aluno.html`. Caso contrário, alguém poderá abrir o arquivo estático diretamente e contornar o login.

O fluxo protegido é:

`login por e-mail → participante vinculado ao auth_user_id → matrícula ativa → turma ativa/no período → RLS libera conteúdo → navegador carrega HTML ou Storage privado`.

## Recuperação e administração

- `esqueci-senha.html` solicita o e-mail e usa o fluxo oficial de recuperação do Supabase Auth.
- `redefinir-senha.html` recebe a sessão de recuperação e grava a nova senha.
- A função `admin-users` cria convites, sincroniza alteração de e-mail e exclui usuários. A `service_role` é lida apenas no ambiente da função.
- Exclusões relacionais seguem as chaves estrangeiras da migration. Módulo com turma vinculada é restrito; matrículas, encontros e frequências vinculados a uma turma são removidos em cascata.

## Planilha de participantes

A primeira aba pode ser CSV/XLSX e deve usar os cabeçalhos: `nome`, `cpf`, `telefone`, `email`, `genero`, `escolaridade`, `endereco`. CPF deve conter 11 dígitos. Cada linha válida gera um convite por e-mail; erros são mostrados individualmente e não interrompem as demais linhas.

## Verificação mínima antes da produção

- testar aluno sem matrícula, matrícula cancelada, turma futura/encerrada e matrícula ativa;
- tentar consultar outra pessoa e outro módulo diretamente pela API;
- confirmar que o bucket é privado e que o caminho começa pelo id do módulo;
- testar convite, login, expiração de sessão e recuperação de senha;
- revisar política de privacidade, base legal, retenção e acesso a CPF/endereço;
- exportar backup e testar restauração.
