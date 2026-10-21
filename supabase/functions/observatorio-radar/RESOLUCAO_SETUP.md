# Resolução inteligente de URLs — Radar.IA

Implementação local: `20261020-resolucao-inteligente`. Publicar no GitHub não instala a migração nem atualiza a Edge Function. Não foram alterados os horários de coleta diária.

## Mapeamento da arquitetura existente

| Responsabilidade | Arquivo / função | Tabela |
| --- | --- | --- |
| Cadastro e seleção dinâmica de fontes | `feeds.mjs`: `carregarFeeds`; painel `portal/admin.js` | `public.observatorio_feeds` |
| Leitura RSS/Atom e diagnóstico | `handler.mjs`: `fetchFeed`, `createRadarHandler`; `feed-network.mjs`: `downloadFeed` | Diagnósticos em `observatorio_feeds` |
| Interpretação, deduplicação e payload editorial | `core.mjs`: `parseFeed`, `dedupeByLink`, `toConteudo` | — |
| Persistência automática para revisão | `handler.mjs`: insert de `unique.map(toConteudo)` | `public.observatorio_conteudos` |
| Decisões humanas da prévia | `portal/radar-curadoria.js`; RPC `observatorio_radar_decidir` | `observatorio_conteudos`, `observatorio_radar_descartes` |
| Conversão/cache anteriores | `google-news.mjs`, `google-news-cache.mjs` | `private.radar_google_links`, `private.radar_google_estado` |
| Fila e reserva exclusivas | `google-news-queue.mjs`; RPCs `observatorio_google_fila_*` | `private.radar_google_fila`, `private.radar_google_fila_controle` |

As migrations anteriores continuam necessárias. A nova migração estende a fila; não cria outra coleta ou outro Cron. O serviço principal permanece JavaScript/Deno e PostgreSQL/Supabase.

## Ordem de resolução

`link direto → cache/banco → RSS oficial do veículo → busca configurada → decoder → pendente`

1. Links diretos públicos HTTPS são preservados sem decodificar. Identificadores Google são normalizados para uma chave única, ignorando variantes como `?oc=5`.
2. Reutiliza o vínculo conhecido no cache/fila; procura também resoluções anteriores de outros IDs e matérias publicadas/revisadas no mesmo domínio/data, evitando refazer a conversão para outro ID da mesma matéria.
3. Consulta o índice dos feeds **explicitamente marcados como oficiais**. A coleta normal indexa os itens que já baixou, sem novo download. O worker pode atualizar até dois feeds compatíveis com o veículo. Google Notícias nunca deve ser marcado como feed oficial de todos os veículos.
4. Opcionalmente consulta Brave Search, com `site:dominio "título"`, até três resultados. Confere no máximo duas páginas candidatas, sem LLM. Título e data precisam ser confirmados na página, não apenas no resultado da busca ou no caminho da URL.
5. Só depois tenta o decoder. O destino retornado também precisa passar por validação da página. Sem título, data e domínio verificáveis, a decodificação externa é evitada.
6. Ausência de resultado, bloqueio, ambiguidade ou dados insuficientes preservam a URL RSS e deixam o item pendente. A resolução não publica notícias.

Correspondência exige domínio cadastrado/indicado pelo veículo, data de publicação exata e título normalizado. Aceita igualdade ou similaridade Dice de palavras >= 0,94, com pelo menos seis palavras distintas para correspondências não exatas. Dois destinos diferentes compatíveis são tratados como ambiguidade. Acentos, pontuação e sufixo do veículo são normalizados. Datas inventadas pelo fallback de exibição, `updated` isolado ou data extraída apenas da URL não confirmam uma correspondência. Isso é deliberadamente conservador: algumas matérias legítimas continuarão exigindo revisão.

## Ativação, nesta ordem

1. No SQL Editor, instale as migrations existentes do Radar, inclusive `202610180001_radar_google_cache.sql` e `202610200001_radar_google_fila.sql`, se ainda não estiverem instaladas.
2. Execute integralmente **`supabase/migrations/202610200002_radar_resolucao_inteligente.sql`**. É aditiva e pode ser reaplicada sem apagar notícias, fila ou tentativas. Não reaplique a migration antiga da fila depois dela, pois isso restauraria o worker SQL anterior.
3. Atualize a Edge Function existente **observatorio-radar** com **`index.web.ts`** deste diretório, como `index.ts` no editor Web. O bundle é gerado por `node scripts/bundle_observatorio_radar.mjs`. Preserve as configurações de autenticação existentes: a função valida sessão e token internamente.
4. Se a fila já tem Cron e Vault configurados, a migração atualiza a função de despacho usada pelo mesmo job. Caso contrário, siga `FILA_SETUP.md`: secret Vault `radar_agent_token` igual ao Secret da Edge `RADAR_AGENT_TOKEN`, depois `supabase/setup/radar_google_fila_cron.sql`. Não execute o Cron antes do deploy da função atualizada.
5. Publique os arquivos do frontend e atualize a página. O cadastro de fontes só mostra os novos campos quando encontra as novas colunas nos registros carregados. Com cadastro vazio, adicione uma fonte, recarregue e edite para marcar a resolução oficial.
6. Em **Fontes do Radar**, edite o feed oficial: marque **Feed oficial do veículo para identificar links originais**, informe `dominio_veiculo`, por exemplo `veiculo.org`, sem protocolo/caminho, e opcionalmente os nomes alternativos separados por vírgula. Não marque automaticamente fontes agregadoras como oficiais. A equipe deve conferir a autenticidade do feed.

`busca_manual` e `busca_automatica` continuam independentes. `resolucao_oficial` autoriza apenas o uso do feed ativo como evidência para identificar links; não liga automaticamente uma dessas duas modalidades. Sem a nova migração, a coleta antiga continua; o novo worker não faz downloads sem conseguir acessar seus controles de resolução.

## API de busca opcional

Por padrão nenhuma API de busca é chamada. Para ativar, configure **Edge Function Secrets**:

```text
RADAR_URL_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=<chave privada da sua conta>
RADAR_URL_SEARCH_DAILY_LIMIT=10
```

`RADAR_URL_SEARCH_DAILY_LIMIT` limita operações de busca por dia de Brasília, entre 1 e 100, para este projeto. O limite local não substitui as cotas/condições da sua conta nem elimina possíveis cobranças. Não exponha a chave no frontend, SQL compartilhado, logs ou Git. O endpoint Brave é fixo; outra API exige implementar um adaptador validado, não apenas trocar a URL. Desative removendo o provider ou definindo `off`.

Referências: [Brave Search API](https://api-dashboard.search.brave.com/documentation/quickstart), [operadores de busca](https://api-dashboard.search.brave.com/documentation/resources/search-operators).

## Último recurso: decoder JavaScript/Deno existente

Toda a resolução roda na Edge Function existente e no PostgreSQL. Não há dependência Python, adaptador externo, hospedagem adicional ou novos secrets para decodificar links.

Sem `RADAR_URL_DECODER_PROVIDER`, o fallback é `legacy`: o decoder JavaScript já existente, agora somente na última camada e sem persistir destino novo antes de validar título, domínio e data. Defina `RADAR_URL_DECODER_PROVIDER=off` para desativar a decodificação Google e manter apenas banco/RSS/busca. Outros valores não ativam provedores externos.

As chamadas respeitam a fila e os bloqueios compartilhados, sem proxies, rotação de IP, cookies fornecidos pelo usuário ou contorno de CAPTCHA. O Google pode mudar o comportamento desses links; o decoder não garante sucesso ou ausência de 429.

## Limites e persistência

| Operação/origem | Intervalo mínimo | Orçamento diário local |
| --- | --- | --- |
| Worker global | 1 item/minuto, um lease ativo | Até 5 rodadas por item |
| Atualização de RSS oficial | 15 minutos por origem | 100 operações |
| Verificação de página | 10 segundos por origem | 200 operações |
| Brave Search | 60 segundos por origem | 10 operações, configurável |
| Google | 60 segundos por origem | 100 operações |

Os contadores são compartilhados entre processos deste projeto. Etapas que usam a mesma origem compartilham o mesmo contador, mesmo com orçamentos diferentes; prevalece o teto da etapa solicitada. São orçamentos conservadores por operação, **não cotas oficiais publicadas pelo Google**. Uma conversão do decoder pode envolver mais de uma requisição interna. O transporte existente permite até três redirecionamentos públicos revalidados; o orçamento é da origem inicial da operação. A leitura RSS normal mantém seus limites anteriores e lotes de quatro fontes; a tabela acima rege a resolução em segundo plano.

- Reserva por origem: 1 minuto; reserva do item: 2 minutos. Resultado de um lease antigo não finaliza um item reservado novamente. Mesmo ID não gera conversões paralelas na fila.
- Backoff do item: 1, 2, 4, 8 minutos. Esperas sem acesso não gastam tentativas; rodadas sem evidência/configuração contam para evitar repetição infinita. Execuções interrompidas contam.
- HTTP 403/429/503: bloqueio compartilhado por origem, respeitando Retry-After; padrão 15 minutos e mínimo local de 1 minuto. Não reduz uma espera válida de vários dias indicada pelo provedor. Uma nova resposta de bloqueio pode estender a pausa. A pausa Google também é sincronizada com o controle legado.
- Índice de RSS: validade de 1 dia, atualização no máximo a cada 15 minutos no resolvedor; mapeamento rápido de URLs: 30 dias. O vínculo durável da fila resolvida é mantido por compatibilidade. O fim de uma pausa não garante desbloqueio do provedor.
- Um destino já decodificado, mas ainda sem título/data confirmados, fica separado como `url_candidata` por até 30 dias. A próxima rodada verifica a página sem repetir o decoder. Candidata não é exibida como original nem aplicada à notícia antes da confirmação.
- Notícias guardam `url_rss`, `url_original`, `url_resolucao_metodo`, `url_resolucao_status`, `url_verificada_em`. O campo `url` continua sendo o endereço operacional, para manter clientes e deduplicação existentes.
- Metadados/contextos ficam em `private.radar_url_observadas`; índice oficial em `radar_url_documentos`; cotas/leases em `radar_url_origens`; eventos em `radar_url_eventos`. Eventos têm retenção de 30 dias, com limpeza ao registrar novos eventos.
- O worker corrige somente itens originados pelo Radar ainda em revisão, sem aprovação/revisão/curadoria concluída. Conteúdos publicados/revisados e URLs coladas manualmente não são sobrescritos. Títulos, datas e status editorial não são alterados. Conflitos de URL/descartes continuam exigindo decisão humana.
- A interface prefere o original; um fallback Google permanece identificado como intermediário. A revisão aberta consulta apenas cache/fila, sem novas decodificações. Para uma falha encerrada, **Reprocessar link** recoloca na fila, sem zerar quotas ou pausas. A atualização pode levar mais de um ciclo.

## Verificar sem expor credenciais

No SQL Editor, como administração:

```sql
select estado, metodo, count(*) as quantidade
from private.radar_google_fila group by estado, metodo;

select origem, quantidade, proxima_em, pausado_ate, reserva_ate
from private.radar_url_origens;

select metodo, estado, http_status, count(*) as eventos,
       round(avg(duracao_ms)) as media_ms
from private.radar_url_eventos
where criado_em > now() - interval '1 day'
group by metodo, estado, http_status;

select public.observatorio_google_fila_disparar();
```

O último comando apenas despacha o worker quando há item pronto. Cron `Succeeded` ou HTTP 200 não comprovam que um endereço foi resolvido; confira os estados e os campos de URL. Logs estruturados `radar_url_resolucao` contêm etapa, estado, HTTP e duração, sem tokens, títulos, URLs completas ou corpos externos. As tabelas privadas e RPCs internos não são acessíveis à chave pública; reprocessamento exige sessão de administrador/curador.

## Validação e limites conhecidos

Testes em `tests/radar-url-resolution*.test.mjs` e testes da fila/cache: prioridade de camadas, dados ambíguos, SSRF, datas, respostas inesperadas, 429, leases/cotas, permissões e preservação editorial. Rede e provedores são simulados; SQL é executado em PostgreSQL/PGlite, inclusive reaplicação da migração. Isso não substitui teste integrado no Supabase hospedado, concorrência multiconexão real nem teste de disponibilidade dos provedores. Os testes não usam chaves nem geram cobranças.

O transporte Deno mantém a pré-validação DNS IPv4 existente e limites de tempo/tamanho; `fetch` pode resolver DNS novamente e a conexão não é fixada ao IP pré-validado. Para uma fronteira SSRF mais forte, use saída de rede restrita/proxy de egress com DNS fixado. JSON com credenciais não segue redirecionamentos. O Radar valida o destino do decoder antes de confirmá-lo como original. A API de busca permanece desativada até configuração explícita.
