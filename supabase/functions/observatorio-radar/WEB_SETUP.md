# Agente Radar com feeds RSS e busca Gemini

## Atualização: resolução inteligente de URLs

Consulte **[RESOLUCAO_SETUP.md](RESOLUCAO_SETUP.md)** para a arquitetura, migração, provedores opcionais e limites. O bundle atual exige também essa atualização no banco para o worker de links; a coleta permanece compatível com o esquema anterior, mas a nova resolução não deve ser ativada antes da migração.

## Atualização: fila automática de links (20/10/2026)

A fila persistente e o agendamento de retomada estão documentados em **[FILA_SETUP.md](FILA_SETUP.md)**. Essa versão substitui o comportamento exclusivamente sob demanda descrito na seção histórica de cache de 18/10 abaixo. Requer nova migration, deploy da função e ativação do job separado; publicar somente o frontend não ativa a fila.

## Curadoria no resultado da busca manual

**Ativação, nesta ordem:**

1. Execute o conteúdo de `supabase/migrations/202610160003_radar_curadoria.sql` no SQL Editor. Requer as migrations anteriores de curadores, sugestões, Radar, feeds e relevância. Não apaga nem republica registros existentes.
2. Substitua a função `observatorio-radar` pelo `index.web.ts` atual e publique. Nenhum secret novo é necessário.
3. Publique `radar.html`, `radar.js`, `radar-curadoria.js` e o CSS atual. O painel antigo ainda tem comportamento de gravação; use o painel atualizado para a prévia.

A busca manual envia `"previa": true`: retorna `previas` com título, resumo, data, fonte e link, sem INSERT em `observatorio_conteudos`. Atualiza somente o diagnóstico de leitura das fontes. Não existe fila escondida de prévias no banco: elas ficam na tela até a decisão e se perdem ao sair/recarregar. O painel avisa se há pendências antes de sair ou iniciar outra busca.

O painel verifica `capacidades.previa_curadoria` na listagem de fontes **antes de habilitar a busca**. Se a função anterior estiver instalada, bloqueia o uso para não gravar acidentalmente uma coleta que deveria ser apenas prévia.

Por candidato:

- **Revisar e publicar:** abre editor de título, resumo, data, fonte e categoria. O link original permanece fixo. O botão **Confirmar e publicar** exige a confirmação humana, no formulário e novamente no banco. Grava `publicado`, revisão humana e aprovação verdadeiras, sem destaque automático, e audita pessoa/data em `curadoria_por`/`curadoria_em`.
- **Salvar para revisão:** grava `revisao`, sem aprovação nem revisão humana concluída; também pode ser escolhido depois de editar o conteúdo no diálogo. A pessoa responsável fica em `submetido_por`, sem copiar seu e-mail para o conteúdo público.
- **Descartar:** registra URL, título, fonte, motivo opcional, pessoa e data em `observatorio_radar_descartes`, não no acervo. Um descarte ativo é ignorado por buscas manuais e automáticas, antes dos limites por feed.

As decisões usam `observatorio_radar_decidir`, autenticada e restrita a administradores/curadores. Visitantes, instrutores e o token da agenda não podem usar essa RPC para publicar. Campos de status/aprovação enviados pelo cliente não determinam o estado: a função SQL o define pela ação e confirmação. Registrar decisões não faz download de URLs nem usa LLM.

Se outra pessoa/agenda já salvou o link enquanto a prévia estava aberta, a decisão retorna **já cadastrado** e não sobrescreve o registro. Para alterar um registro existente, use Publicações. Repetir uma decisão não cria outra publicação. A migration serializa decisões e inserções do Radar por URL e usa um trigger para bloquear reinclusão de descartes/duplicatas, inclusive em inserções automáticas concorrentes. Isso não cria uma restrição universal de URL para cadastros não originados do Radar.

**Buscas automáticas:** os jobs atuais continuam funcionando sem alterar o body. Sem `previa: true`, novos itens entram no acervo com `status = revisao`, sem publicação automática, constituindo a fila persistente em **Publicações do Observatório**. O token da agenda permanece válido. Não foram criados nem alterados horários de Cron nesta implementação. Gemini manual também usa prévia; cobranças de busca/geração continuam existindo mesmo que você descarte depois.

**Restaurar um descarte:** somente a administração pode definir `ativo = false` na tabela `observatorio_radar_descartes` no Supabase. Os curadores podem ler os descartes, mas não apagar nem reativar diretamente. Não há escrita pública. O serviço interno apenas consulta a tabela; as decisões são feitas pela RPC com a sessão humana.

**Compatibilidade:** aplique a migration antes da função. Sem a tabela de descartes, a coleta falha com instrução de atualização, sem voltar silenciosamente para uma coleta sem filtro de descartes. `itens` continua sendo a relação de registros efetivamente inseridos pelas chamadas automáticas; `previas` contém apenas os novos candidatos manuais ainda não salvos. Nada da nova tela retroage sobre os itens coletados anteriormente.

Validação: testes da função com banco/rede simulados, teste dos controles da tela e teste SQL em PostgreSQL/PGlite em memória (papéis/Auth simulados, sem acesso ao Supabase real). O teste SQL opcional é `tests/radar-curadoria-db.test.mjs`, com `RADAR_PGLITE_MODULE` apontando para `dist/index.js` de PGlite 0.3.7. Ele verifica migration, RLS, publicação sem confirmação, descarte, trigger e reexecução da migration; não substitui um teste no ambiente hospedado nem um teste de concorrência real com múltiplas conexões.

## Transporte padrão com `fetch()`

Se a coleta exibir `Not implemented: ClientRequest.options.lookup`, o feed não foi lido: é uma incompatibilidade da API Node de rede no Edge Runtime, não falta de notícias nem problema no filtro.

Atualize a função `observatorio-radar` colando novamente o conteúdo **completo e atual** de `index.web.ts` como `index.ts` e publique. Não requer migration, mudança de secrets nem recadastro de fontes.

O downloader usa o `fetch()` padrão, sem `node:https`, `lookup` de ClientRequest, socket TCP ou TLS manual. A verificação normal de certificados HTTPS fica a cargo do runtime. Timeout cobre DNS, resposta e leitura do corpo. Os redirecionamentos são manuais e revalidados, no máximo três; o corpo é lido em streaming com limite de 2 MB, inclusive após descompressão feita pelo fetch.

Segurança e limite conhecido: URLs exigem HTTPS público, sem credenciais, IP literal ou porta personalizada, e há uma consulta DNS IPv4 prévia que recusa endereços privados/mistos. **Isso não fixa o IP usado pelo fetch**, que pode resolver novamente e usar outro endereço ou IPv6. Não é garantia contra DNS rebinding; somente administradores confiáveis devem cadastrar fontes. Não exponha o cadastro a visitantes/curadores nem aceite URLs arbitrárias no corpo da execução. Se for necessária proteção SSRF forte com pinning, use um proxy de saída controlado em vez de afirmar que a checagem prévia garante isso.

Os testes cobrem streaming, limite, timeout de DNS/rede/corpo, status HTTP e revalidação de redirects. Uma leitura real com fetch no Deno portátil 2.1.4 retornou 20 itens do Google AI, após redirecionamento 301 e resposta 200. Houve também uma tentativa com timeout local; a disponibilidade de rede varia. A ativação no runtime hospedado deve ser confirmada após o deploy manual pelo Dashboard; testes locais não alteram o banco.

## Atualizar uma função existente

**Primeiro o banco, depois a função e por último o site.** No SQL Editor, cole o conteúdo completo (não o nome do arquivo) e execute, nesta ordem:

1. `supabase/migrations/202610160001_observatorio_feeds.sql`
2. `supabase/migrations/202610160002_observatorio_relevancia.sql`
3. `supabase/migrations/202610160003_radar_curadoria.sql`

Pré-requisitos: migrations anteriores de administração/curadoria, Radar e sugestões, inclusive as funções `private.is_observatorio_admin()` e `private.is_observatorio_curador()`. As novas migrations não corrigem instalações parcialmente criadas. Não foram executadas remotamente pelo assistente.

Depois:

1. Em **Edge Functions → observatorio-radar → Code**, substitua todo o conteúdo de `index.ts` pelo conteúdo completo de `index.web.ts` desta pasta e publique.
2. Mantenha **Verify JWT with legacy secret** desligado. A função aceita o token secreto da agenda ou valida a sessão do usuário e exige um dos perfis `administrador`, `observatorio_admin` ou `observatorio_curador`.
3. Para usar Gemini, cadastre em **Edge Functions → Secrets**:

   - `GEMINI_API_KEY`: chave da sua conta Google AI. Não coloque essa chave no HTML nem no JavaScript do site.
   - `GEMINI_MODEL`: modelo compatível com Google Search e saída JSON estruturada. Exemplo documentado atualmente: `gemini-3.8-flash`.

4. Publique os arquivos do site para disponibilizar **Executar Radar** no menu do painel. A interface é `radar.html`.

O modo feeds continua funcionando sem chave Gemini. As agendas existentes que não enviam `modo` continuam usando feeds. O modo Gemini exige escolha explícita e não é ativado automaticamente pela presença da chave.

## Escolher o modo

Na interface, escolha **Feeds RSS** para selecionar fontes do catálogo, ou **Gemini** para informar tema, período e quantidade máxima de notícias. Os usuários não precisam conhecer o token secreto da agenda.

Também é possível usar o botão Test da função com o header `x-radar-token` e estes exemplos de body:

```json
{
  "modo": "feeds",
  "fontes": ["UNESP (IA)", "USP (IA)", "Google AI"],
  "limite_por_feed": 3,
  "limite_total": 20
}
```

Sem `fontes`, são usados todos os feeds do catálogo.

```json
{
  "modo": "gemini",
  "consulta": "pesquisas e aplicações de inteligência artificial na educação brasileira",
  "dias": 7,
  "limite_total": 10
}
```

Gemini usa a API Interactions com Google Search e saída estruturada. Há uma pesquisa por execução, com até **5 tentativas totais** (inicial + 4 retentativas) somente quando há HTTP 429 ou erro `RESOURCE_EXHAUSTED`. As pausas são 4, 8, 16 e 32 segundos. `Retry-After`, quando maior, é respeitado. As retentativas não alteram o tema nem o corpo da chamada. O modelo pode fazer mais de uma consulta Google dentro de cada tentativa. Os limites de resultados não são um teto financeiro: há custos e cotas de geração e busca na conta Google AI. Confira a [documentação de busca](https://ai.google.dev/gemini-api/docs/google-search) e a [saída estruturada com ferramentas](https://ai.google.dev/gemini-api/docs/structured-output).

O helper limita cada chamada/leitura a 60s e o conjunto de chamadas e esperas a 130s. Pode encerrar antes das cinco tentativas se o prazo acabar ou o `Retry-After` não couber: isso reserva margem para responder antes do limite HTTP de 150s do Supabase. Não é uma fila persistente e não garante sucesso quando a cota diária está esgotada ou é zero. Nessas situações, a função devolve HTTP 429 com `{ "error": "mensagem clara" }`; não grava conteúdos dessa busca. Falhas de rede/timeout, autenticação, JSON e demais HTTP não são repetidas automaticamente. Nenhuma mensagem inclui corpo bruto do erro ou credenciais.

Não existe loop de chamadas Gemini por tópico/resultado: os loops atuais apenas processam a resposta e os feeds RSS. Portanto, não foi adicionada espera aos loops locais nem à coleta RSS. Se futuramente houver consultas Gemini sequenciais distintas, deverá haver uma pausa mínima de 3s entre elas, além do backoff. O controle atual não impõe RPM global entre invocações/usuários concorrentes.

Para ativar este backoff, substitua o código completo de `observatorio-radar` no Supabase Web pelo `index.web.ts` regenerado. Não há novo SQL, novo Secret ou mudança necessária no servidor do site. `GEMINI_API_KEY` e `GEMINI_MODEL` continuam sendo lidos com `Deno.env.get` pelo ponto de entrada existente. A validação local usa respostas e relógios simulados, sem consumir chamadas Google.

O diagnóstico dos erros agora é anexado ao mesmo campo JSON `error`, que o painel já exibe como texto. Informa modelo solicitado, HTTP do Google, número de tentativas e, quando presentes, status/mensagem do provedor, identificador/métrica/valor da cota e espera de `RetryInfo`. Não infere falta de acesso apenas pelo HTTP 404, nem cota diária apenas pelo 429: a mensagem retornada pelo Google é que permite distinguir as causas. Campos ausentes não são inventados.

Somente os campos selecionados são usados; corpo bruto, stack trace e demais metadados não são expostos. A chave atual (literal e codificada), padrões de chaves Google/Bearer, URLs, e-mails, referências `projects/...` e identificadores numéricos longos são ocultados; HTML é removido. Mensagem limitada a 400 caracteres e diagnóstico completo a cerca de 2.400. Essa filtragem não substitui a cautela ao compartilhar erros e capturas. Erros sem JSON continuam com diagnóstico básico. Segredos inválidos/ausentes mantêm a validação anterior. Nenhum teste usa a chave real.

São aceitas até 20 notícias no modo Gemini, com período de até 30 dias, incluindo hoje. Só são salvas URLs também citadas nas fontes da resposta de busca. Datas desconhecidas, inválidas, futuras ou fora do período são descartadas, sem usar a data de coleta como publicação. Se a busca não retornar fontes verificáveis, a execução falha sem salvar conteúdos.

Os itens Gemini são identificados por `agente_origem = radar_gemini`; os feeds mantêm `radar`. Coletas automáticas e a ação Salvar para revisão usam `status = revisao`, `aprovado_curadoria = false` e `revisao_humana = false`. Somente a decisão humana Confirmar e publicar muda esses valores. O resumo Gemini é preparado por IA, e a data ainda exige conferência na publicação original. A presença de uma citação não é validação humana dos fatos. A deduplicação compara os links com os já cadastrados, sem substituir publicações existentes.

As fontes citadas e as sugestões Google retornam à interface; as sugestões são exibidas em um iframe isolado. Notícias descartadas e feeds que falharam são apresentados no resultado da execução.

## Banco e permissões

O banco deve ter as migrations do Radar e de sugestões aplicadas, incluindo `aprovado_curadoria`, `agente_origem`, `agente_processado_em` e `observacao_colaborador`. São as colunas já usadas pelo painel e pela curadoria.

Se o banco retornar erro de permissão para o serviço do Radar, execute no SQL Editor:

```sql
grant select, insert on public.observatorio_conteudos to service_role;
grant usage, select on sequence public.observatorio_conteudos_id_seq to service_role;
```

Nenhuma chave de serviço deve ser copiada para o site.

## Arquivo único e catálogo

`index.web.ts` é gerado a partir dos módulos desta pasta e das primitivas de validação de URL/IP já usadas por `observatorio-link/core.mjs`. Execute `node scripts/bundle_observatorio_radar.mjs` após alterações. Cole o resultado inteiro no Supabase Web como `index.ts`; ele não depende de arquivos adicionais no editor Web.

Não existe mais catálogo fixo nem fallback no runtime. O painel consulta a própria função com `{"acao":"listar_fontes"}`, após autenticação. Essa ação não faz coleta, não chama Gemini e não grava nada. A lista reflete os feeds ativos do banco. O antigo JSON estático foi removido.

## Catálogo no banco e triagem RSS

As 24 fontes anteriores são cadastradas pela migration, sem sobrescrever edições em reexecuções. `nome` substitui `origem` no cadastro; o adaptador mantém `origem`/`url` internamente para preservar o parser e o formato das publicações. `fontes` aceita código, nome, categoria ou URL, sem distinção de maiúsculas/minúsculas. Seleções desconhecidas/inativas não provocam fallback para todos os feeds.

Somente `ativo = true` é processado, em ordem de prioridade e nome, com até quatro downloads simultâneos. Prioridade define a ordem de candidatos quando o limite total é atingido, não uma frequência de execução. Nenhum agendamento é criado ou alterado nesta etapa. Um catálogo grande pode exceder o tempo disponível da Edge Function; divida a agenda em grupos pelo parâmetro `fontes` se necessário.

O downloader usa fetch com validação HTTPS/DNS IPv4 prévia, redirecionamentos manuais, timeout e corpo limitado a 2 MB. Não fixa IP na conexão; veja a limitação de segurança no início deste guia. Compressão HTTP fica a cargo do fetch; páginas HTML em vez de RSS/Atom são recusadas pelo processamento. Os erros aparecem por feed; não se assume que todos os endpoints preservados estejam disponíveis.

Regras locais, sem API ou LLM no modo RSS:

- Termo forte no título/resumo: +5/+2. Entidade/modelo: +4/+1. Repetir um termo no mesmo campo não soma pontos novamente.
- Acentos e caixa são normalizados; siglas IA/AI só pontuam como palavras inteiras com contexto tecnológico. O filtro é heurístico e pode errar, especialmente com nomes ambíguos como Gemini, Mistral e Llama.
- `SCORE_MINIMO_IA = 4` para tecnologia. Geral exige um ponto adicional (5). O secret opcional `RADAR_SCORE_MINIMO_IA` altera o limiar base (inteiro 1–100); os clientes não podem baixá-lo pelo body.
- `relevancia_ia = min(100, score_bruto × 10)`. Fontes com escopo `ia` dispensam o limiar se há título/link, com mínimo 90 por especialização da fonte. Isso não mede veracidade ou qualidade do conteúdo.
- Classificação calculada: 80+ alta; 60+ relevante; 40+ revisar; 0–39 baixa. Só o número é persistido, para evitar classificação redundante. Registros antigos e Gemini permanecem sem avaliação (`NULL`); não são reclassificados automaticamente.

Todos os itens válidos do feed passam pela triagem **antes** de `limite_por_feed` e `limite_total`. A deduplicação atual ocorre depois dos limites e não preenche vagas liberadas por duplicatas. `itens_lidos` conta itens com título/link aceitos pelo parser; itens inválidos sem esses campos não entram nesse contador. `itens_relevantes_ia` é anterior aos limites. `itens_fora_limites` explica a diferença entre relevantes e candidatos. Nenhum desses limites é quantidade de aprovações humanas.

`feeds_com_erro` continua sendo uma lista, para não quebrar o painel anterior. A contagem numérica nova é `quantidade_feeds_com_erro`. `feeds` detalha cada fonte. `ultima_execucao`, status e quantidades representam a última leitura/triagem, não histórico acumulado nem confirmação de gravação de cada notícia. Erros ao atualizar esses diagnósticos retornam em `avisos`, sem interromper outras fontes. Execuções simultâneas podem sobrescrever o diagnóstico mais recente; a deduplicação atual também não garante exclusividade entre execuções concorrentes. Evite sobrepor agendas.

### Testar uma fonte e verificar o filtro

No **Test** da função, POST, com `x-radar-token` configurado (ou sessão do curador), use:

```json
{"modo":"feeds","fontes":["tecnoblog"],"limite_por_feed":10,"limite_total":20,"debug":true}
```

Confira `feeds[0].status`, `lidos`, `relevantes_ia`, `descartados_nao_ia`, e `exemplos_descartados` (máximo 20, com score bruto e normalizado). Sem `debug: true`, os exemplos não são retornados. Este JSON sem `previa` representa uma coleta automática: candidatos são salvos em revisão. Para testar sem inserir no acervo, acrescente `"previa": true`; o painel manual já envia essa opção e mostra estatísticas por fonte. Repetir uma coleta pode resultar em zero inserções por deduplicação.

Requisição normal (todos os ativos):

```json
{"modo":"feeds","limite_por_feed":3,"limite_total":20}
```

Para comparar o filtro de forma determinística, rode localmente `node --test tests/radar-feeds-db.test.mjs`. Os testes usam feeds e banco simulados; não consomem Gemini nem acessam o banco real.

Após um teste real, confira no SQL Editor:

```sql
select codigo, ativo, ultima_execucao, ultimo_status, ultimo_erro,
       quantidade_lida, quantidade_relevante
from public.observatorio_feeds order by prioridade, nome;

select titulo, relevancia_ia, status, destaque, revisao_humana, aprovado_curadoria
from public.observatorio_conteudos
where agente_origem = 'radar'
order by agente_processado_em desc limit 20;
```

### Cadastrar/desativar fontes

No **Table Editor → observatorio_feeds → Insert row**, preencha código único, nome, URL HTTPS pública, categoria, escopo, prioridade e ativo. Ou use SQL, substituindo o endereço ilustrativo por um RSS/Atom real:

```sql
insert into public.observatorio_feeds
  (codigo,nome,url_feed,instituicao,categoria,escopo,idioma,pais,prioridade,ativo)
values
  ('nova-fonte','Nova fonte','https://feeds.sua-instituicao.edu.br/rss.xml',
   'Sua instituição','pesquisa','ia','pt-BR','BR',2,true);

-- Sem excluir a fonte nem os conteúdos anteriores:
update public.observatorio_feeds set ativo = false where codigo = 'nova-fonte';
```

Para testar esse cadastro: `{"fontes":["nova-fonte"],"debug":true,"limite_por_feed":10}`. Escolha `ia` somente para feeds realmente exclusivos de IA; buscas por “observatório” são `geral`, e tecnologia ampla usa `tecnologia`.

RLS: acesso anônimo negado. Administradores (`administrador`/`observatorio_admin`, pela função existente) podem consultar e administrar; curadores somente leem fontes ativas. O serviço interno tem SELECT/UPDATE para carregar fontes e atualizar diagnóstico. Não se concede escrita pública nem chave de serviço ao navegador.

### Relação dos resultados

Na tela manual, o resultado mostra **Novos conteúdos — prévia** (`previas`) e **Já cadastrados no banco** (`itens_ja_cadastrados`, com id, título, URL e fonte). A busca manual mantém `inseridos = 0`; só uma decisão humana grava um novo conteúdo. Quando todos os candidatos já existem, a segunda lista continua mostrando os links. O título/fonte da curadoria são preservados; não há atualização nem reinserção desses registros. Chamadas automáticas ainda retornam `itens` com os registros efetivamente inseridos.

Cada URL já cadastrada aparece uma só vez na lista, mesmo se encontrada em várias fontes. O contador `duplicados` continua contando as ocorrências descartadas. `repetidos_na_coleta` informa repetições de links novos na própria coleta, que não devem ser confundidas com registros anteriores do banco. Os limites por feed e total, a ordem e a deduplicação não foram alterados.

Para ativar esta relação, atualize a função com o novo `index.web.ts` **e** publique `radar.html`/`radar.js`. Não exige SQL. Se só o painel for atualizado, uma função antiga pode continuar coletando, mas a tela avisará que precisa atualizar a função para mostrar os links anteriores.

### Gestão pelo portal

Acesse **Administração do Observar.IA → Fontes do Radar** ou `administracao-observatorio.html?secao=observatorio_feeds`. Administradores podem cadastrar, editar e ativar/desativar. A lista mostra a última execução, erro e quantidades lida/relevante, somente para consulta. Não há exclusão na interface: desativar preserva o cadastro. Salvar não executa a coleta.

O formulário usa o editor administrativo existente e grava com a sessão do administrador, protegido pelas mesmas políticas RLS desta migration. Não exige nova migration nem outra função. Recarregue o Radar depois de salvar para atualizar as opções. O link de gestão no Radar é exibido somente para administradores.

No Radar, **Todas as fontes ativas** é o padrão explícito. **Escolher fontes** abre os checkboxes com contador, **Marcar todas** e **Desmarcar todas**. Seleção personalizada vazia bloqueia a execução, em vez de consultar todas acidentalmente. Gemini continua independente dessa seleção.

Não publique a função nova antes das duas migrations. Sem tabela/permissão, a coleta RSS falha com instrução de correção; não há fallback silencioso para lista fixa. Guarde a versão anterior da função antes da troca. Para voltar o código, deixe as novas colunas/tabela no banco: elas não exigem apagar dados nem desfazer as migrations.

## Primeira instalação

Use este guia quando você não tiver a Supabase CLI.

## 1. Preparar o banco

No Supabase Web, abra **SQL Editor** e execute o SQL abaixo:

```sql
alter table if exists public.observatorio_conteudos
  add column if not exists aprovado_curadoria boolean not null default false,
  add column if not exists agente_origem text,
  add column if not exists agente_processado_em timestamptz;

create index if not exists observatorio_radar_curadoria_idx
  on public.observatorio_conteudos(origem, aprovado_curadoria, status, updated_at desc);

create index if not exists observatorio_url_idx
  on public.observatorio_conteudos(url);
```

## 2. Criar o secret

Antes de continuar, execute também as duas migrations `202610160001` e `202610160002` descritas no início deste guia, além das migrations anteriores necessárias de administração/curadoria.

No Supabase Web, abra **Edge Functions > Secrets** e crie:

```text
Name: RADAR_AGENT_TOKEN
Value: escolha-uma-senha-forte
```

## 3. Criar a Edge Function

Crie uma função chamada:

```text
observatorio-radar
```

No editor web, cole o conteúdo de:

```text
supabase/functions/observatorio-radar/index.web.ts
```

como `index.ts`.

## 4. Testar

Faça uma chamada POST para:

```text
https://brdjzyutqdakabaolxiy.supabase.co/functions/v1/observatorio-radar
```

Headers:

```text
x-radar-token: sua-senha-forte
Content-Type: application/json
```

Body:

```json
{
  "limite_por_feed": 3,
  "limite_total": 20
}
```

Se funcionar, a resposta terá:

```json
{
  "ok": true,
  "agente": "radar",
  "inseridos": 0
}
```

`inseridos` pode ser `0` se os links encontrados já existirem no banco.

# Fontes separadas para busca manual e automática

Após a curadoria em prévia, execute o **conteúdo** de `supabase/migrations/202610160004_radar_fontes_uso.sql` no SQL Editor. Depois atualize `observatorio-radar` com o conteúdo completo de `index.web.ts` e publique o painel. Não cole apenas os nomes dos arquivos.

Em **Administração do Observar.IA → Fontes do Radar → Editar fonte**, configure:

- **Fonte ativa**: desligada, exclui a fonte de todas as buscas.
- **Disponível na busca manual**: aparece na seleção do painel.
- **Incluir na busca automática**: participa das execuções autenticadas pelo token da agenda.

As duas últimas opções são independentes. Ambas desmarcadas preservam o cadastro, mas não consultam a fonte. A migration inicia ambas como `true` para preservar o funcionamento anterior; reexecutá-la não sobrescreve as escolhas administrativas. Não altera conteúdos, políticas RLS, horários ou limites.

O contexto é determinado pela autenticação: sessão da equipe = manual; `RADAR_AGENT_TOKEN` = automática. O corpo não pode trocar esse contexto. A listagem do painel retorna somente fontes manuais. Se o Cron já enviar `fontes`, ele consultará apenas a interseção dessa seleção com as fontes automáticas ativas; para usar todas as automáticas configuradas, remova `fontes` do corpo ou envie `[]`. Confira isso no comando de cada job antes de considerar a configuração aplicada a todas as fontes. Seleção sem fontes elegíveis retorna erro explícito, sem recorrer às outras fontes.

Essas configurações se aplicam ao modo **Feeds RSS**, não à pesquisa web livre do Gemini. Limites continuam definidos por execução: os controles do painel não alteram o corpo do Cron. Buscas automáticas continuam salvando em revisão, nunca publicando automaticamente. A função anterior não reconhece as novas opções; portanto, só considere a separação ativa após atualizar também a função. O novo painel exige essa capacidade para habilitar a busca.

## Groq: descobrir links e extrair metadados das páginas

Ativação, nesta ordem:

1. Nos Secrets das Edge Functions, cadastre `GROQ_API_KEY` com a chave **Groq**. Não substitua `GEMINI_API_KEY` por uma chave Groq. Não cole a chave no código, no chat ou no site.
2. Opcional: `GROQ_MODEL=openai/gpt-oss-20b` (padrão). A alternativa permitida é `openai/gpt-oss-120b`. Os nomes são modelos hospedados na Groq; não usam a API OpenAI. Modelos Compound descontinuados não são usados.
3. Substitua o conteúdo completo de `observatorio-radar` no Supabase Web por `index.web.ts` e publique a função.
4. Publique o frontend. O painel só habilita a opção quando `listar_fontes` retorna `capacidades.groq_links=1`. Não há migration nova; os pré-requisitos das migrations anteriores continuam necessários.
5. Escolha **Groq — descobrir links e extrair dados das páginas**, período Hoje e 1 resultado para o primeiro teste.

Este modo é exclusivamente manual (`previa=true` obrigatório), com no máximo 3 links por execução. Uma chamada Groq usa `browser_search` obrigatório, raciocínio `low` e teto de 2.048 tokens. Não usa JSON schema, incompatível com essa ferramenta segundo a [documentação Groq](https://console.groq.com/docs/tool-use/built-in-tools/browser-search). Solicita apenas URLs, uma por linha: sem título/resumo gerados. Não há garantia de uma única operação interna da ferramenta, custo zero, ausência de cotas ou disponibilidade no plano. Nenhum fallback/retry Groq automático ou atualização de plano é feito.

A chave fica somente no header Authorization enviado à Groq. As páginas não recebem credenciais Groq/Supabase. A busca tem timeout de 60s e cada página de 8s (até 3 sequenciais). A coleta usa o fetch existente, com validação HTTPS público, DNS IPv4 prévio, redirects manuais revalidados, limite de 2MB e MIME HTML. Limitação conhecida: a checagem DNS não fixa o IP usado pelo fetch e não é uma garantia completa contra DNS rebinding/IPv6; veja as limitações de rede acima. Bloqueios, paywalls e erros de página não são contornados.

Antes de baixar as páginas, remove descartes conhecidos e consulta links já cadastrados. Usa o extrator puro de `observatorio-link` para título, descrição, fonte e data. O bundle inclui esse extrator isolado e suas regras de datas, **não** o transporte `node:https` incompatível com lookup no Deno hospedado. Campos não são inventados nem resumidos pela Groq. Apenas matérias completas, com data dos metadados/dados estruturados dentro do período, viram prévias; data inferida somente da URL não basta. Fontes incompletas/bloqueadas aparecem como links descobertos e avisos para conferência manual, sem virar registros do acervo. Não é prova independente de que todo link foi retornado pelo índice: são sugestões da IA, conferidas pela leitura da página.

O fluxo de decisão mantém o RPC e as políticas de curadoria existentes. Para compatibilidade sem novo SQL, `agente_origem` permanece `radar`; `observacao_colaborador` identifica explicitamente Groq e o modelo. Os modos feeds e Gemini, horários de Cron, limites RSS e seus descartes não são alterados. O modo Groq não implementa ainda controle financeiro diário de R$ 1, registro persistente de consumo ou cobrança por usuário.

Os testes locais simulam a API e as páginas: não validam a chave do usuário, a disponibilidade de browser_search no plano, as cotas, os custos ou o funcionamento final no runtime hospedado. Nenhuma chamada real Groq foi feita.

## Google Notícias: cache persistente e pausa compartilhada (18/10/2026)

Ordem de implantação:

1. Execute o **conteúdo completo** de `supabase/migrations/202610180001_radar_google_cache.sql` no SQL Editor. Não cole apenas o caminho do arquivo.
2. Substitua `observatorio-radar → Code → index.ts` pelo conteúdo completo do `index.web.ts` regenerado e clique em **Deploy updates**.
3. Atualize o painel publicado e use Ctrl+F5. Nenhum Secret novo é necessário.

As tabelas ficam no schema `private`, sem leitura/escrita direta para usuários ou para a chave pública. Somente a Edge Function com service role executa os dois RPCs de cache/controle. As permissões de curadoria continuam sendo verificadas antes da conversão individual.

- Conversões novas bem-sucedidas ficam em cache por 30 dias. Variantes `/rss/articles/`, `/articles/` e `/read/` do mesmo ID compartilham a chave, ignorando parâmetros como `oc` e `hl`.
- A busca RSS em lote só consulta esse cache ou decodifica IDs antigos offline. Novas consultas Google ocorrem sob demanda, ao revisar/salvar um item. Não há retries automáticos de 429.
- O banco permite uma conversão externa por vez no projeto. Uma reserva expira em 45 segundos se a execução morrer; há intervalo de 5 segundos após a conclusão antes de consultar outro link novo.
- Ao receber 429 na página ou na conversão RPC, respeita `Retry-After` (segundos ou data HTTP); sem indicação válida, pausa por 15 minutos. Essa pausa é uma precaução local, não uma estimativa de desbloqueio do Google.
- A pausa vale entre usuários, sessões e instâncias da função. Links em cache continuam disponíveis durante a pausa. Depois dela, uma nova tentativa depende de uma ação do usuário; não é criado agendamento nem tarefa em segundo plano.
- Se a migration estiver ausente ou o controle não puder ser consultado, não acessa o Google como fallback: mostra aviso de cache indisponível. Nenhuma publicação, fonte, descarte ou job Cron é alterado pela migration.
- Cache novo não recupera retroativamente conversões antigas nem aprende automaticamente endereços colados manualmente. Bloqueios do Google não são contornados; não há garantia de resolver links novos durante um bloqueio.

O botão **Copiar diagnóstico** informa `origem_resolucao`, motivo da pausa e `retomar_em`, sem copiar leases privados, chaves, cabeçalhos ou o corpo bruto da resposta. Os testes usam rede simulada e PostgreSQL local em memória; não exercitam o Supabase real nem o Google durante o bloqueio.
