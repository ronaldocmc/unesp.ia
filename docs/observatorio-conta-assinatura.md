# Conta única, Observar.Dia e sugestões

## Entrega

- Mesma identidade em Supabase Auth para portal e Observatório. Não cria
  participante, matrícula, papel administrativo ou senha em tabela própria.
- `participar-observatorio.html`: senha, cadastro nome/e-mail/senha e Google OAuth.
  Usuários existentes entram com a conta existente; não há mesclagem artesanal por
  e-mail. Associação de identidades é responsabilidade do Supabase Auth; e-mails
  diferentes não são tratados como a mesma pessoa.
- `minha-conta-observatorio.html`: nome, assinatura opcional, cancelamento e
  histórico paginado das sugestões próprias. Inscrição exige e-mail confirmado
  e escolha explícita; criar conta ou acessar página nunca inscreve ninguém.
- Sugestões usam a fila editorial existente, agora por RPC com identidade e
  estado editorial definidos no banco, sem publicação automática.
- `interessados-observatorio.html`: administração consulta por nome/e-mail e
  inscritos/cancelados/não inscritos/e-mail pendente. Lista somente quem salvou
  preferências; contas Auth que nunca o fizeram não aparecem. Curadores não
  podem consultar os e-mails dessa lista.

Não envia resumos, gera imagem/podcast ou posta em redes. Confirmação de cadastro
e recuperação são mensagens do Supabase Auth, não do resumo. Não inscreve usuários
existentes automaticamente.

## Ativação (manual, ainda não realizada)

1. Aplicar `supabase/migrations/202610310001_observatorio_conta_assinatura.sql`.
   Requer migrations existentes de conteúdos, sugestões, `aprovado_curadoria`
   e `private.is_observatorio_admin`. É reaplicável, sem apagar dados existentes.
2. Publicar novos HTML, CSS e JS e as atualizações de Observatório, administrador,
   sugestões, `supabase.js` e `auth-pages.js`. A migration remove a antiga policy
   de inserção direta de colaboradores: publicar a interface e o banco em conjunto.
3. Supabase Auth: habilitar cadastro por e-mail e **Confirm email**, configurar
   SMTP de entrega real e revisar limites/CAPTCHA antes da divulgação. A aplicação
   verifica `email_confirmed_at`, mas confirmação automática no painel não substitui
   a confirmação por mensagem. Manter **Confirm email** ativado.
4. Habilitar Google com cliente OAuth institucional; nunca pôr seu segredo no
   repositório. Callback no Google:
   `https://brdjzyutqdakabaolxiy.supabase.co/auth/v1/callback`.
   Pedir apenas identidade/perfil/e-mail, sem escopos Gmail.
   A tela consulta as configurações públicas de Auth e só libera o botão Google
   quando o provedor está habilitado. Falha nessa consulta não bloqueia o e-mail.
5. Site URL: domínio canônico. Configurar Redirect URLs do Supabase para:
   - `https://ia.fct.unesp.br/minha-conta-observatorio.html`
   - `https://ia.fct.unesp.br/sugerir-observacao.html`
   - `https://ia.fct.unesp.br/redefinir-senha.html` (incluindo retorno com query
     conforme a configuração de redirecionamentos do projeto).
   - equivalentes em `https://ronaldocmc.github.io/unesp.ia/`, se usados.
   Não usar curingas amplos em produção. Testar também os retornos dos cursos.
   Sessões são por origem: trocar de domínio pode exigir novo login, não cadastro.
6. Revisar os textos de uso dos dados, os contatos e a retenção institucional
   antes do lançamento. A página descreve esta etapa, não substitui uma política
   institucional completa.

Documentação oficial:
[Google](https://supabase.com/docs/guides/auth/social-login/auth-google),
[redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls),
[OAuth](https://supabase.com/docs/reference/javascript/auth-signinwithoauth).

## Dados e segurança

`private.observatorio_interessados`: FK Auth, nome, preferência, datas e versão
do consentimento. E-mail vem de Auth, não de campo arbitrário. A tabela privada
`observatorio_assinatura_eventos` audita mudanças; salvamento repetido não duplica
eventos. RLS habilitada, sem acesso direto do cliente. RPCs têm `search_path` fixo
e validam identidade no servidor, não em metadados editáveis.

Sugestões exigem confirmação: até 10 novas por usuário/dia de Brasília, com
serialização concorrente, limites de texto e duplicatas próprias idempotentes.
Campos extras de aprovação, autoria ou publicação são ignorados. Gravação em
revisão, sem destaque, sem aprovação. A RPC não faz requisição à URL; o importador
é separado e conserva suas proteções de rede.

Histórico retorna somente ID, título, link, data e situação. Publicado com revisão
= publicada; arquivado = não selecionada; demais = aguardando revisão. Não permite
editar ou excluir sugestões pelo usuário. A equipe usa a curadoria existente.

Cancelar mantém conta e sugestões. Excluir a identidade em Auth remove preferências
e eventos por cascade, mas preserva conteúdo editorial com autoria nula; o campo
histórico `submetido_email` precisa de tratamento administrativo segundo a política
de retenção. Exclusão de conta é solicitada por contato, não automática nesta tela.
Qualquer distribuição futura deverá revalidar assinatura ativa e e-mail confirmado
no momento de enviar, nunca apenas a existência do perfil.

## Verificação

Testes em `tests/observatorio-conta.test.mjs`: validação, retorno seguro, escolha
explícita, autenticação/RLS, confirmação, isolamento entre usuários, permissões
administrativas, auditoria idempotente, cancelamento, sugestões sem escalada,
limites, histórico e DOM sem HTML de usuário, filtros e paginação.

Após ativar: testar com contas de teste cadastro/confirmação, senha, Google, conta
existente, recuperação, assinatura/cancelamento, envio/duplicata/histórico,
publicação/arquivamento pela curadoria e acesso negado à lista privada para
curadores/usuários comuns. Não criar contas reais nem enviar e-mails em lote para testar.
