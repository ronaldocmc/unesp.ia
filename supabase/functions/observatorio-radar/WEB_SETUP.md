# Agente Radar com feeds RSS e busca Gemini

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

Gemini usa a API Interactions com Google Search e saída estruturada, em uma chamada por execução, sem tentativas automáticas adicionais. O modelo pode fazer mais de uma consulta Google dentro dessa chamada. Os limites de resultados não são um teto financeiro: há custos e cotas de geração e busca na conta Google AI. Confira a [documentação de busca](https://ai.google.dev/gemini-api/docs/google-search) e a [saída estruturada com ferramentas](https://ai.google.dev/gemini-api/docs/structured-output).

São aceitas até 20 notícias no modo Gemini, com período de até 30 dias, incluindo hoje. Só são salvas URLs também citadas nas fontes da resposta de busca. Datas desconhecidas, inválidas, futuras ou fora do período são descartadas, sem usar a data de coleta como publicação. Se a busca não retornar fontes verificáveis, a execução falha sem salvar conteúdos.

Os itens Gemini são identificados por `agente_origem = radar_gemini`; os feeds mantêm `radar`. Os dois modos usam `status = revisao`, `aprovado_curadoria = false` e `revisao_humana = false`. O resumo Gemini é preparado por IA, e a data ainda exige conferência na publicação original. A presença de uma citação não é validação humana dos fatos. A deduplicação compara os links com os já cadastrados, sem substituir publicações existentes.

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

Confira `feeds[0].status`, `lidos`, `relevantes_ia`, `descartados_nao_ia`, e `exemplos_descartados` (máximo 20, com score bruto e normalizado). Sem `debug: true`, os exemplos não são retornados. O painel oferece a mesma opção e mostra estatísticas por fonte. **Não é dry-run:** os candidatos são salvos em revisão. Repetir a coleta pode resultar em zero inserções por deduplicação.

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

O resultado tem duas listas: **Novos registros** (`itens`, mantido para compatibilidade) e **Já cadastrados no banco** (`itens_ja_cadastrados`, com id, título, URL e fonte). Quando todos os candidatos já existem, `inseridos` será zero, mas a segunda lista continua mostrando os links. O título/fonte da curadoria são preservados; não há atualização nem reinserção desses registros.

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
