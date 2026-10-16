# Agente Radar com feeds RSS e busca Gemini

## Atualizar uma função existente

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

`index.web.ts` é gerado a partir de `core.mjs`, `gemini.mjs`, `handler.mjs` e `index.ts`. Para atualizar os arquivos gerados após alterações no código, execute `node scripts/bundle_observatorio_radar.mjs`. O script também gera o catálogo público `assets/data/radar-fontes.json` usado pela interface.

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
