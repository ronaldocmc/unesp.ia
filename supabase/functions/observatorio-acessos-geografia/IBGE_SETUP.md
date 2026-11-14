# Município aproximado com base IBGE no PostGIS

## Implantação (não automática pelo GitHub Pages)

1. No SQL Editor do mesmo projeto Supabase, executar inteiro
   `supabase/migrations/202611010001_observatorio_geografia_ibge.sql`.
   Requer as migrations de acessos 202610220001, 202610310002 e 202610310003 já aplicadas.
   Preserva contagens e histórico; pode ser reaplicada.
2. Executar inteiro `supabase/migrations/202611020001_observatorio_ibge_postgis.sql`.
   Cria PostGIS no schema `extensions`, tabela privada com RLS e índice espacial, e RPC
   permitida somente a `service_role`. Se PostGIS já estiver em outro schema, a migração
   para com uma mensagem: não remover a extensão existente; adaptar os qualificadores.
3. No Table Editor, selecionar schema `private`, tabela `observatorio_ibge_municipios`
   e usar Import data from CSV para carregar `supabase/data/ibge-municipios-2022.csv`.
   O arquivo contém somente `codigo_ibge`, `nome`, `uf` e `geojson`; `geom` é calculado
   pelo banco e `base_geografica` recebe o padrão. Não mapear coluna para `geom`.
   Importar uma única vez, em tabela vazia. Não apagar visitas nem reimportar sobre as
   mesmas chaves. Se houver erro ou importação parcial, verificar antes de continuar.
   A consulta não identifica municípios até existirem exatamente 5.570 linhas.
4. Em Edge Functions → `observatorio-acessos-geografia` → Code, substituir **todo** o
   `index.ts` pelo conteúdo de `index.web.ts` desta pasta e clicar em Deploy updates.
   Não juntar com a versão anterior. Agora o arquivo é pequeno: a base está no banco.
   Alternativamente, fazer deploy via CLI da função modular com seus arquivos locais.
5. A interface já existente continua compatível; não há alteração de interface nesta etapa.
   Não há chave IBGE nem novos Secrets. Preservar a configuração existente de IP,
   origens permitidas e autenticação da função.
6. Abrir uma nova sessão de visita no Observatório público (não apenas no administrador),
   autorizar localização e consultar as estatísticas. Sessão já contabilizada com navegador
   não é regravada: testar com sessão nova, por exemplo outra janela privada fechando as anteriores.
   Recusa, indisponibilidade e sinais DNT/GPC mantêm os comportamentos anteriores.
7. A tabela deve mostrar método `Navegador autorizado (aproximado)`, cidade e referência
   `IBGE-malhas-2022-simplificada` com código do município quando houver correspondência.
   A cidade do visitante não é garantida: precisão do dispositivo e limites simplificados afetam o resultado.

## Base e privacidade

- Fonte oficial: [API Malhas IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3)
  e [API Localidades](https://servicodados.ibge.gov.br/api/docs/localidades).
- Geometria fixada em **2022**, qualidade mínima/simplificada, 5.570 municípios.
  Não é uma malha cadastral nem a edição territorial mais recente. Nomes obtidos da API
  Localidades no momento da geração; URLs, data e hashes estão em `ibge-proveniencia.json`.
- `ibge-data.mjs` contém apenas limites públicos, nomes, códigos e caixas envolventes.
  Não contém dados de visitantes. `scripts/build_ibge_municipios.mjs` renova a base
  explicitamente; nunca é executado durante uma visita.
- A consulta espacial ocorre dentro do Supabase/PostGIS, sem transmitir coordenadas ao IBGE
  ou a geocodificadores. Usa apenas coordenadas já arredondadas a duas casas decimais.
- A célula de arredondamento precisa estar integralmente dentro de um município da
  base, sem tocar limites, incluindo buracos/enclaves. Ambiguidade, sobreposição,
  ponto fora do Brasil/base, importação incompleta ou erro deixam município e referência em branco.
  Geometrias inválidas são recusadas na importação. O exportador repara a topologia com
  GEOS `make_valid` (linework), preserva os componentes poligonais e registra cada reparo
  em `supabase/data/ibge-municipios-2022-validacao.json`. A base original é preservada.
- A margem da célula **não representa a precisão do dispositivo**. Não comprova presença
  física nem corrige coordenadas imprecisas ou falsificadas. Sem rastreamento contínuo.
- Método de coleta continua `navegador`, separado de `ip`. Novos agregados guardam
  `codigo_ibge` e `base_geografica`; dados antigos não são reconstruídos ou reclassificados.
- Se a função antiga permanecer publicada após a migration, seguirá gravando sem cidade.
  Atualizar somente o site não atualiza a função.

## Verificação somente leitura

```sql
select count(*) as municipios from private.observatorio_ibge_municipios;
-- Esperado: 5570. Executar como administrador no SQL Editor.
select public.observatorio_municipio_ibge(-22.28, -51.50);
-- Esperado: Pirapozinho, código 3539202.
select public.observatorio_municipio_ibge(40.71, -74.00);
-- Esperado: {} (fora da base brasileira).

select dia, metodo, cidade, regiao, codigo_ibge, base_geografica, quantidade
from private.observatorio_acessos_geo_dia
where metodo = 'navegador'
order by dia desc
limit 20;
```

## Desenvolvimento

Após modificar a base ou função, executar `node scripts/bundle_observatorio_acessos_geografia.mjs`.
Para gerar novamente o CSV sem consultar a rede: instalar previamente `shapely==2.1.2`
no Python e executar `node scripts/export_ibge_csv.mjs`. A variável `IBGE_PYTHON` pode
indicar o executável Python. O gerador só grava após validar as 5.570 geometrias,
unicidade dos códigos, round-trip CSV e célula de teste de Pirapozinho.
Reparos com mudança de área superior a 0,1% (tolerância absoluta 1e-8 graus²)
interrompem a geração para revisão. Linhas/pontos colapsados não representam área
municipal e são excluídos do resultado poligonal. Não remover a constraint do banco.
Testes da integração com RPC e limite de tamanho: `node --test tests/observatorio-ibge-postgis.test.mjs`.
Os testes locais simulam a RPC. A extensão PostGIS deve ser validada no banco antes
de ativar a função; PGlite não substitui essa validação espacial.
Testar `node --test tests/observatorio-ibge.test.mjs tests/observatorio-geografia-metodos.test.mjs`.
Para executar também os testes SQL, definir `RADAR_PGLITE_MODULE` para o módulo PGlite instalado.
Uma futura troca da edição deve atualizar validação SQL, provenance e testes; não substituir
silenciosamente a geometria mantendo o mesmo identificador de base.
