# Ativar a fila automática de links originais

> Atualização: a resolução em camadas, os novos campos e a configuração de provedores estão em [RESOLUCAO_SETUP.md](RESOLUCAO_SETUP.md). Instale também a migration `202610200002_radar_resolucao_inteligente.sql` antes de usar o bundle atual. As orientações abaixo descrevem a base da fila.

Esta implementação não usa LLM, não consome tokens de IA, não contorna bloqueios e não garante a resolução de todos os links. Usa banco, Cron e Edge Functions, sujeitos às cotas de infraestrutura do Supabase.

## Ordem de ativação no projeto unesp-ia-portal

1. Execute no SQL Editor a migration anterior `202610180001_radar_google_cache.sql`, se ainda não estiver instalada. Depois execute o conteúdo completo de **`supabase/migrations/202610200001_radar_google_fila.sql`**. A nova migration enfileira também os registros antigos elegíveis; reexecutá-la não limpa a fila nem reinicia falhas.
2. Atualize **observatorio-radar**, colando o `index.web.ts` atual como `index.ts`, e publique. A função já valida sessões/token internamente; mantenha a configuração existente de JWT legado desativado. Não crie uma função com outro nome.
3. Em **Supabase Vault**, crie o secret **`radar_agent_token`** com exatamente o mesmo valor do Secret **`RADAR_AGENT_TOKEN`** das Edge Functions. Vault e Edge Secrets são armazenamentos separados. Não mostre o valor em consultas de diagnóstico, screenshots, no chat, no Git ou no frontend. Não use service_role como token da agenda.
4. Com Cron/pg_net ativos, execute **`supabase/setup/radar_google_fila_cron.sql`**. Ele cria/atualiza somente o job `observatorio-radar-links`, a cada minuto. O endpoint está configurado para este projeto; se copiar a outro projeto, ajuste a URL pública antes de executar. O agendamento diário de coleta não muda.
5. Publique o painel e recarregue com Ctrl+F5. Ao manter o editor de um link pendente aberto, ele consulta apenas fila/cache a cada 30 segundos por até 30 minutos. Essa consulta não gera novos acessos Google. A retomada em segundo plano depende do Cron ativado, não da janela aberta.

Publicar no GitHub não instala SQL, secrets ou a função no Supabase. Sem o novo SQL, a coleta continua funcionando com um aviso de fila indisponível; sem o novo deploy, o worker não reconhece a ação. Não ative o Cron antes da função: um body não reconhecido pela função antiga poderia executar a coleta padrão.

## Funcionamento e proteção editorial

- Uma reserva global permite **um link por minuto**, inclusive em chamadas concorrentes. Cada resolução pode precisar de uma página e uma chamada de conversão Google. Usa ainda a trava e pausa compartilhadas da conversão individual.
- IDs antigos e URLs já conhecidos são reaproveitados sem acessar o Google. O cache rápido dura 30 dias; a fila preserva o vínculo já identificado entre ID e endereço.
- Cada link tem até **5 tentativas**. Falhas têm espera progressiva (1, 2, 4, 8 minutos antes das tentativas seguintes). HTTP 429 respeita Retry-After ou 15 minutos quando ausente; prevalece o maior prazo. Passar o prazo não significa que o Google liberou o servidor.
- Uma corrida em que a pausa aparece entre a reserva da fila e o acesso Google não consome tentativa de rede. Execução interrompida mantém reserva por 2 minutos e conta uma tentativa, evitando repetição infinita. No limite, o item fica `falhou`, para conferência manual.
- A fila guarda URLs e estado, não cria publicações a partir de prévias. Prévia não salva é perdida ao sair, como antes; seu link pode continuar na fila/cache para reaproveitamento.
- Registros do Radar ainda em `revisao`, sem revisão/aprovação/curadoria concluída, recebem apenas o URL original e a remoção de aviso antigo de conversão. Título, resumo, fonte, data, destaque e status não mudam. Conteúdo publicado, aprovado, revisado, arquivado ou cadastrado manualmente não é alterado.
- Se já existir outro registro com o destino ou houver descarte ativo, o worker não mescla, exclui nem sobrescreve: registra conflito para conferência. Editar manualmente o link no formulário prevalece sobre uma atualização tardia da fila.
- Consultas manuais consultam apenas cache e fila; novas requisições externas ficam no worker. Após cinco rodadas sem resolução, a curadoria pode escolher **Reprocessar link**. Isso não remove pausas nem reinicia contagens diárias dos provedores.
- A tabela e os RPCs internos são inacessíveis à chave pública e usuários autenticados. O worker exige o token interno da agenda. Nunca devolve tokens de reserva, credenciais ou corpos brutos do Google ao painel.

## Diagnóstico sem expor secrets (SQL Editor, administração)

```sql
SELECT estado, count(*) AS quantidade
FROM private.radar_google_fila GROUP BY estado;

SELECT google_key, estado, tentativas, proxima_em, ultimo_motivo
FROM private.radar_google_fila
ORDER BY atualizado_em DESC LIMIT 20;

SELECT jobname, schedule, active
FROM cron.job WHERE jobname = 'observatorio-radar-links';
```

Em Cron, `Succeeded` confirma o despacho SQL, não a conclusão HTTP. Confira também os logs de **observatorio-radar** para a ação `processar_fila_google` e os estados acima. Para testar sem aguardar o minuto, execute `select public.observatorio_google_fila_disparar();` no SQL Editor; ele pode retornar NULL se não houver trabalho pronto. Não use `select *` nas tabelas de Vault/requests para compartilhar diagnósticos.

Para pausar, desative somente `observatorio-radar-links` no painel Cron. Para reabrir uma falha específica após investigar a causa, a administração pode redefinir `estado='pendente', tentativas=0, proxima_em=now(), token=null, reserva_ate=null` na linha exata da fila. Isso preserva o conteúdo e não contorna a pausa Google.

Referência do agendamento: https://supabase.com/docs/guides/functions/schedule-functions
