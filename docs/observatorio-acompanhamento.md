# Acompanhamento do Radar e curadoria

## Ativar

1. Aplicar no SQL Editor do Supabase a migration completa `supabase/migrations/202610250001_observatorio_acompanhamento.sql`. Requer migrations anteriores de curadoria e resolução inteligente. É reaplicável e não altera notícias, fila, pausas ou decisões.
2. Publicar `administracao-observatorio.html`, `assets/js/portal/admin.js`, `assets/js/portal/observatorio-acompanhamento.js` e `assets/css/observatorio-acompanhamento.css`.
3. Entrar como administrador ou observatorio_admin e abrir **Acompanhamento do Radar e curadoria** no menu lateral. Nenhuma Edge Function precisa ser atualizada.

## Critérios

- **Editorial:** apenas registros persistidos em `observatorio_conteudos`. Aguardando validação = em revisão + aguardando curadoria. Arquivados são separados; publicado só conta como tal se `status=publicado` e revisão humana concluída. O campo independente de aprovação de curadoria também aparece, sem alterar registros históricos que foram publicados por cadastro manual.
- **Técnica:** um registro por chave da fila de links. Resolução de URL não implica aprovação editorial. Próxima tentativa futura em um pendente aparece como “Aguardando próxima tentativa”, não como confirmação de bloqueio HTTP. Motivo, tentativas e atualização ficam visíveis.
- **Descartes:** apenas descartes ativos do Radar, sem somar aos arquivados ou às pendências editoriais. Não há reativação nem exclusão neste painel.
- Links sem conteúdo persistido associado exibem esse fato e não entram no total editorial. A associação usa URLs Google normalizadas nas colunas `url` e `url_rss`; múltiplos cadastros para a mesma chave não duplicam o item técnico. Mostra o cadastro associado atualizado mais recentemente.
- **Evidências:** link direto cadastrado, fallback Google ou ausência. “Direto” não significa que título, data ou conteúdo foram confirmados. URL original identificada, URL coletada e método aparecem separadamente quando disponíveis. Não executa leitura de páginas externas.
- **Filtros:** busca em título/veículo/fonte/motivo, período de cadastro/descarte em Brasília, veículo, fonte, categoria, origem, feed registrado, situação, revisão humana, estado do link e tipo de evidência. Busca é literal (não usa `%` ou `_` como curingas).
- Feed exato não foi preservado em todos os fluxos anteriores; nesses casos mostra “Não informado”. O filtro aceita `nao_informado`. Não identifica feed por semelhança do nome do veículo; os campos `feed_codigo`, `feed_nome`, `feed_id` só são usados quando constam no contexto da fila. Cadastros editoriais e descartes antigos não têm esse dado.
- Contadores, total e paginação são calculados **no banco**, sobre todos os resultados filtrados. Cada página tem 25 itens; o máximo permitido pela RPC é 100. Atualização é manual (Aplicar filtros / Atualizar), não executa coleta, decodificação, reprocessamento ou alteração de status.
- Pausas por origem são informações gerais, independentes dos filtros da lista, sem tokens de reserva ou outros segredos. Horários são exibidos em Brasília. O término de uma pausa não garante êxito.
- “Abrir para revisão” usa o editor existente e suas validações; abrir não publica ou aprova. Depois de salvar, reabra o acompanhamento para consultar os novos números.

## Permissões e teste manual

A RPC exige `private.is_observatorio_admin()` no servidor. Usuário anônimo, autenticado sem esse papel e curador comum não podem consultar a view privada ou o relatório. Não retorna e-mails, usuários, contexto bruto ou tokens de execução. Inputs limitados a 4 KB; paginação e lista validadas; não usa SQL dinâmico.

Teste uma consulta sem filtros e depois por revisão pendente, por veículo e por fallback Google. Navegue entre páginas sem perder os filtros. Abra um conteúdo para revisão, confirme que o formulário original aparece e cancele para não alterar dados. Confira erros de migration ausente e resultados vazios. A existência de registros na fila técnica não garante que todas as prévias possam ser recuperadas: prévias não salvas continuam não sendo publicações do acervo.

## Atividade real do processador

Aplicar também `202610250002_radar_worker_monitor.sql`, após as migrations da resolução inteligente. Não requer atualizar a Edge Function: mantém os contratos das RPCs de reserva e finalização existentes. Reaplicar uma migration antiga que redefina essas funções exige reaplicar a migration do monitor por último.

- **Execução recebida:** o worker chamou a reserva no banco, mesmo se retornou aguardar, ocupado ou fila sem elegíveis. Não usa sucesso do cron/HTTP 200 como prova. Se não há execução nos últimos cinco minutos, mostra “Sem sinal recente”, não afirma que o serviço está definitivamente parado: o disparador também pode evitar chamadas quando não há itens elegíveis.
- **Em processamento:** item com reserva vigente; não prova que uma requisição externa está ocorrendo naquele instante.
- **Tentativa com consulta concluída:** a finalização foi aceita com `p_consultou=true`, sinal informado pelo resolvedor após consulta. Conta ciclos por item, não quantidade de requisições HTTP, e pode envolver feeds, busca ou Google. Espera por cota, título ausente e `p_consultou=false` não contam como tentativa. Se o processo falhar antes da finalização, esse ciclo não entra nessa contagem.
- **Resolução confirmada:** transição da fila para resolvido ou inserção já resolvida (inclusive cache). Atualizar novamente um registro que já está resolvido não soma. Reprocessar um link e resolvê-lo de novo pode somar outra operação de resolução: não é uma contagem de links únicos vitalícios.
- Contagens de hoje em Brasília, independentes dos filtros. São eventos desde a ativação, sem histórico retroativo. Retenção dos eventos: 30 dias, limpeza quando chega novo evento. Exibe última execução, última tentativa com consulta concluída, última resolução, resultado/motivo mais recente e próxima elegibilidade. Sem tokens, dados de usuários ou contexto bruto.
- Atualização pelo botão **Aplicar filtros / Atualizar**. Verificar execução, tentativa e resultado em conjunto; um serviço pode estar rodando sem conseguir resolver nada.
