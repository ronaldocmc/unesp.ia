# Conversa do Observar.IA

A opção **sem LLM** funciona no navegador com o acervo público já carregado. Reconhece termos, sinônimos básicos, tipos de conteúdo e períodos por regras; não gera análises nem chama APIs de IA. Custos normais de hospedagem/banco continuam sujeitos ao plano.

A opção **com LLM** precisa desta função separada do Radar. Ela consulta até os 1.000 registros publicados e revisados mais recentes, recupera até seis fontes por busca lexical e envia apenas títulos/resumos, pergunta e até quatro mensagens anteriores ao provedor escolhido. Não consulta páginas externas nem faz pesquisa na web. Uma pergunta sem fontes correspondentes recebe orientação sem chamar o provedor. A recuperação não é semântica e pode exigir reformulação.

## Ativar no Supabase

1. No SQL Editor, execute integralmente `supabase/migrations/202610190001_observatorio_conversa.sql`. Pode ser executado novamente sem apagar os contadores.
2. Em Edge Functions, crie **observatorio-conversa**. Cole o conteúdo completo de `index.web.ts` como `index.ts` e publique. Desative a verificação JWT legada da plataforma para esta função: ela própria valida a sessão com `Auth.getUser` antes de consultar o acervo ou reservar cota. Não remova essa validação do código.
3. Em Secrets, mantenha `GROQ_API_KEY` e/ou `GEMINI_API_KEY`. As chaves existentes do Radar são compartilhadas entre funções; não as copie para o HTML/JavaScript público nem para o Git. Não é necessária chave service_role para a conversa.
4. Opcionalmente defina `GROQ_CHAT_MODEL` e `GEMINI_CHAT_MODEL`. Na ausência deles usa `GROQ_MODEL`/`GEMINI_MODEL`; padrões: `openai/gpt-oss-20b` e `gemini-3.8-flash`. Confirme disponibilidade e cotas na sua conta. Gemini usa o endpoint REST `generateContent`; Groq usa Chat Completions.
5. No portal, abra **Conversar**, teste primeiro **Sem LLM**. Para testar LLM, faça login, selecione provedor e aceite o envio/consumo. Uma pergunta com fontes fará uma chamada real, sujeita ao plano da API.

## Proteções e limites

- 10 chamadas por usuário/dia e 50 no projeto/dia; Groq e Gemini compartilham os contadores. Dia no fuso America/Sao_Paulo. Intervalo de 15 segundos por usuário.
- Reserva atômica no banco; falhas depois da reserva contam. Falha no controle de consumo impede a chamada, sem fallback nem repetição automática.
- Pergunta de até 1.000 caracteres, histórico de até 4×500, até 6 resumos de 700 e saída limitada a 1.200 tokens pelo provedor. Respostas incompletas/bloqueadas são rejeitadas.
- **Limites de chamadas não garantem R$ 1,00 por dia.** Preço depende do modelo, entrada/saída e condições do provedor. Configure controles adicionais na conta antes de habilitar cobrança. Usuários autenticados podem usar a função; não é exclusiva de curadores.
- Sem registro de perguntas/respostas no banco da aplicação. Contadores privados usam UUID e dia; logs de infraestrutura e políticas de retenção do provedor são independentes. Histórico fica na memória da página até limpar/recarregar.
- Apenas registros `status=publicado` e `revisao_humana=true`. Conteúdo recuperado é tratado como dado não confiável; a IA pode errar. Cartões de fontes vêm do banco, não de URLs inventadas pelo modelo. A resposta não é salva nem publicada no acervo.

Para regenerar o arquivo único: `node scripts/bundle_observatorio_conversa.mjs`. Testes automatizados usam provedores simulados, sem consumir tokens reais. Publicar o site não publica esta função nem aplica a migração.
