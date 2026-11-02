# Município aproximado com base local IBGE

## Implantação (não automática pelo GitHub Pages)

1. No SQL Editor do mesmo projeto Supabase, executar inteiro
   `supabase/migrations/202611010001_observatorio_geografia_ibge.sql`.
   Requer as migrations de acessos 202610220001, 202610310002 e 202610310003 já aplicadas.
   Preserva contagens e histórico; pode ser reaplicada.
2. Em Edge Functions → `observatorio-acessos-geografia` → Code, substituir **todo** o
   `index.ts` pelo conteúdo de `index.web.ts` desta pasta e clicar em Deploy updates.
   Não juntar com a versão anterior. O arquivo inclui a base municipal completa.
   Alternativamente, fazer deploy via CLI da função modular com seus arquivos locais.
3. Publicar os arquivos de interface alterados no servidor/GitHub Pages.
   Não há chave IBGE nem novos Secrets. Preservar a configuração existente de IP,
   origens permitidas e autenticação da função.
4. Abrir uma nova sessão de visita no Observatório público (não apenas no administrador),
   autorizar localização e consultar as estatísticas. Sessão já contabilizada com navegador
   não é regravada: testar com sessão nova, por exemplo outra janela privada fechando as anteriores.
   Recusa, indisponibilidade e sinais DNT/GPC mantêm os comportamentos anteriores.
5. A tabela deve mostrar método `Navegador autorizado (aproximado)`, cidade e referência
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
- A consulta ponto/polígono ocorre na Edge Function, sem transmitir coordenadas ao IBGE
  ou a geocodificadores. Usa apenas coordenadas já arredondadas a duas casas decimais.
- A célula de arredondamento precisa estar integralmente dentro de um município da
  base, sem tocar limites, incluindo buracos/enclaves. Ambiguidade, sobreposição,
  ponto fora do Brasil/base ou erro deixam município e referência em branco.
- A margem da célula **não representa a precisão do dispositivo**. Não comprova presença
  física nem corrige coordenadas imprecisas ou falsificadas. Sem rastreamento contínuo.
- Método de coleta continua `navegador`, separado de `ip`. Novos agregados guardam
  `codigo_ibge` e `base_geografica`; dados antigos não são reconstruídos ou reclassificados.
- Se a função antiga permanecer publicada após a migration, seguirá gravando sem cidade.
  Atualizar somente o site não atualiza a função.

## Verificação somente leitura

```sql
select dia, metodo, cidade, regiao, codigo_ibge, base_geografica, quantidade
from private.observatorio_acessos_geo_dia
where metodo = 'navegador'
order by dia desc
limit 20;
```

## Desenvolvimento

Após modificar a base ou função, executar `node scripts/bundle_observatorio_acessos_geografia.mjs`.
Testar `node --test tests/observatorio-ibge.test.mjs tests/observatorio-geografia-metodos.test.mjs`.
Para executar também os testes SQL, definir `RADAR_PGLITE_MODULE` para o módulo PGlite instalado.
Uma futura troca da edição deve atualizar validação SQL, provenance e testes; não substituir
silenciosamente a geometria mantendo o mesmo identificador de base.
