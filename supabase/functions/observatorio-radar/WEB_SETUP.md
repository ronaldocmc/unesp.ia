# Agente Radar pelo Supabase Web

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

Exemplo de senha:

```text
Radar_ObservarIA_2026_fct_9xP42Lm88
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
