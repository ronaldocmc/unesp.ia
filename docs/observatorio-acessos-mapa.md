# Mapa de acessos — Leaflet e origem aproximada

## Atualização: navegador opcional e alternativa por IP

Aplicar **depois** da migration 002 o arquivo
`supabase/migrations/202610310003_observatorio_geografia_metodos.sql` e republicar
**todo** `supabase/functions/observatorio-acessos-geografia/index.web.ts`.
Manter verify_jwt=false e as configurações existentes do provedor/IP. Em seguida,
publicar HTML/JS/privacy atualizados. Não precisa configurar geocodificador novo.
Migração reaplicável; o fluxo anterior somente por IP continua compatível.

Ao inicializar a página, fazemos um único getCurrentPosition, sujeito à permissão
do navegador. Uma decisão anterior pode ser lembrada sem novo aviso. Não há
watchPosition, acompanhamento em segundo plano nem coordenadas no storage.
As coordenadas são arredondadas **no navegador antes de transmitir**, a duas
casas decimais (~1 km, variável com latitude), e revalidadas/arredondadas no
servidor/banco. Precisão reportada acima de 20 km, recusa, indisponibilidade ou
erro de envio mantêm a alternativa IP. DNT/GPC continuam desativando métricas e
nenhuma localização é solicitada se o tracker não puder iniciar.

Nenhum provedor externo recebe coordenadas do navegador. Sem geocodificação
reversa, o nome do município/país/estado fica vazio nesse método; o mapa mostra
a célula aproximada e o método. Não misturamos cidade estimada pelo IP com ponto
do navegador. Deixe filtros de país/estado/cidade vazios para ver esses pontos.
Nenhum método comprova presença física: payloads de clientes podem ser forjados.

`private.observatorio_acessos_geo_dia.metodo` distingue `navegador`, `ip`,
`nao_identificado` e `legado`. O método anterior não pode ser inferido com certeza,
por isso não reclassificamos histórico como IP. `celula` separa áreas arredondadas
do navegador, que não possuem município. Não guardamos precisão original, IP,
nome, e-mail ou identidade de conta nessas tabelas.

Se uma sessão já tiver IP registrado após a migration, a localização autorizada
substitui atomicamente seu agregado, sem aumentar o total de visitas. Para isso,
o recibo temporário guarda a **chave do agregado anterior**, inclusive a célula
arredondada se aplicável, até a limpeza oportunista da janela de dois dias.
Essa é uma associação temporária sessão/área, não anonimato absoluto. Relatórios
administrativos não retornam recibos ou identificadores de sessão. Recibos
anteriores à migration não têm chave segura de substituição e não são alterados;
para testar, iniciar sessão nova numa janela anônima nova.

Para usar apenas IP, negar ou revogar a permissão do site no navegador.
Isso não apaga agregados já enviados. Nenhum IP substitui uma localização do navegador
já registrada nessa sessão/dia. Não há acompanhamento de deslocamento.

Teste manual após implantação: janela anônima nova → visitar Observatório →
autorizar pedido do navegador → consultar origens sem filtros → método navegador e ponto.
Em outra sessão, recusar → método IP (ou não identificado se cota/provedor/IP
indisponível). Atualizar na mesma sessão não deve aumentar totais. Testar também
timeout, bloqueio de localização, DNT/GPC e painel sem carregar Leaflet.

As seções abaixo descrevem o fluxo original somente por IP; esta atualização
acrescenta o método opcional sem substituir as proteções de origem e cotas.

## Arquitetura

As métricas existentes continuam independentes. Depois de registrar a visita, o
navegador faz uma chamada sem login à Edge Function `observatorio-acessos-geografia`,
enviando apenas o UUID efêmero de sessão. Ela reserva no banco a visita já existente,
consulta a estimativa por IP quando configurada ou recebe coordenadas previamente
arredondadas pelo navegador após opt-in, e finaliza o agregado.
Não recebe IP, nome ou e-mail do corpo do cliente. Não acompanha deslocamentos.

Banco privado:

- `observatorio_acessos_geo_dia`: data Brasília, país ISO2, estado/região, cidade,
  coordenadas aproximadas com uma casa decimal e quantidade.
- `observatorio_acessos_geo_recibos`: data, UUID de sessão, token de reserva,
  validade e conclusão. Após a migration 003, também guarda a chave da área/método
  anterior para substituição sem duplicação, nunca IP ou coordenadas brutas. Exclusão oportunista após a
  janela de dois dias em novas reservas, como nos recibos das métricas existentes.
- `observatorio_geo_controle`: cota e pausa compartilhadas, sem identificador pessoal.

Recibos e reservas impedem duplicação por sessão/dia e replays de finalização.
A sessão não é pessoa única nem mecanismo antifraude. CORS, UUID e deduplicação
não impedem robôs que forjam visitas; o ingresso deve ter proteção de abuso.
Sem identificador de conta nas tabelas geográficas e sem IP persistido nelas.
O IP ainda pode aparecer em logs da infraestrutura e é enviado ao provedor
quando habilitado; não há promessa de anonimato absoluto.

## Implantação

1. Aplicar `supabase/migrations/202610310002_observatorio_acessos_geografia.sql`.
   Requer a migration original de métricas. Reaplicável, sem apagar histórico.
   Reserva/finalização são RPCs **exclusivas de service_role**; a chave permanece
   na função, nunca no navegador. Consulta do mapa exige administrador.
2. Publicar a nova Edge Function com `verify_jwt=false` conforme `supabase/config.toml`:
   `supabase functions deploy observatorio-acessos-geografia --no-verify-jwt`.
   O runtime já fornece SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
   Alternativa pelo editor: usar index.web.ts gerado pelo script de bundle.
3. Revisar o aviso de uso dos dados e os termos do provedor antes de ativar a
   transferência de IPs. Habilitar IPWhois explicitamente por secrets:
   `GEO_PROVIDER=ipwhois`, `GEO_PROVIDER_ENABLED=true`.
4. **Validar o ingresso antes de confiar em headers.** Não escolher o primeiro
   X-Forwarded-For sem comprovar a cadeia de proxies. Confirmar que o proxy de
   confiança remove/sobrescreve valores enviados pelo cliente e não permite
   contornar esse proxy. Só então definir `GEO_TRUSTED_INGRESS=true` e
   `GEO_IP_HEADER=x-real-ip` (ou `cf-connecting-ip`, conforme o contrato validado).
   Para X-Forwarded-For, definir também `GEO_XFF_INDEX_FROM_RIGHT` de 0 a 9 segundo
   a cadeia efetivamente validada, nunca por tentativa para obter uma cidade.
   Enquanto não confirmado, a função não consulta o provedor e registra origem
   não identificada. Não inventa a localização pelo IP do servidor.
5. Origens padrão: `https://ia.fct.unesp.br` e `https://ronaldocmc.github.io`.
   Se necessário definir `GEO_ALLOWED_ORIGINS` com origens exatas separadas por
   vírgula. Esse controle não autentica visitantes nem substitui o gateway.
6. Publicar HTML/JS/CSS atualizados. As visitas continuam sendo contadas se a
   função geográfica não estiver instalada ou se falhar. O mapa só terá dados
   novos; os acessos anteriores aparecem como “sem registro geográfico”.

Não foram aplicadas migrations, configurados secrets ou consultados IPs reais
por esses arquivos. A ativação do ingresso/provedor precisa de conferência do
responsável pela infraestrutura; estar no Supabase não comprova por si só que
um header recebido pela aplicação é confiável.

## Cotas e falhas

IPWhois é um adaptador substituível em `core.mjs`; endpoint HTTPS fixo e sem
redirecionamentos, timeout de 2 s e resposta limitada a 10 KB. Sem cache durável
de IP, nem consultas do navegador visitante a serviços GeoIP. 500 consultas/dia
de Brasília, intervalo global mínimo de 2 s e pausa compartilhada em HTTP 429
respeitando Retry-After numérico ou data (24 h quando ausente/inválido).
Outras falhas de rede/HTTP pausam por 60 s. Reserva antes da consulta garante
cota mesmo em timeout. Sem nova consulta automática para uma sessão já finalizada.
Visitas durante pausa, cota, IP indisponível ou provedor desabilitado entram como
não identificadas. Reserva expirada pode ser retomada sem duplicar o agregado.

Os 500/dia são uma proteção interna, não uma garantia de saldo na conta do
provedor, cujo limite pode ser compartilhado com outros serviços. Confira plano
e condições atuais: [documentação](https://ipwhois.io/documentation) e
[termos](https://ipwhois.io/terms). A chave/conta paga não é necessária para o
adaptador gratuito, mas disponibilidade e limites podem mudar.

## Painel e mapa

Dentro de Estatísticas de acesso: consultar origens por período (até 367 dias),
país ISO2, estado/região e cidade. Mostra totais completos e os totais filtrados
separados; até 1.000 localidades, avisando truncamento. Locais sem coordenadas
continuam na tabela, sem ponto fictício em (0,0).

Leaflet estável 1.9.4 via CDN com SRI, carregado somente após “Carregar mapa
Leaflet”; tabela sem dependência de CDN/tiles. Círculos proporcionais às visitas,
popups construídos com DOM/textContent (sem HTML de dados), zoom máximo 8 e sem
rolagem automática. Coordenadas são áreas estimadas/arredondadas, não centroides
oficiais ou endereço do visitante. Troca de filtros remove a instância anterior.

Tiles padrão HTTPS OpenStreetMap, atribuição visível, cache normal do navegador,
sem prefetch, downloads em lote ou modo offline. O Referer do navegador não é
suprimido para tiles. É possível passar tileURL e attribution em mapOptions ao
montar o painel para trocar de provedor. Validar as condições antes da troca.
Não enviar dados pessoais ao serviço de tiles.

Referências: [Leaflet](https://leafletjs.com/download.html),
[política de tiles OSM](https://operations.osmfoundation.org/policies/tiles/),
[precisão GeoIP](https://support.maxmind.com/knowledge-base/articles/maxmind-geolocation-accuracy).

## Verificar

Testes locais: RPCs com papéis anon/authenticated/service_role; visita prévia,
replay, cotas, pausas, arredondamento, isolamento e relatório; handler com headers
não confiáveis, origem falsa, corpo inválido, HTTP 429 e falhas; painel com Leaflet
simulado, filtros, popups seguros, limpeza do mapa e indisponibilidade.
Depois de configurar, testar com acessos de teste em rede conhecida e tentativa
de falsificar headers pelo cliente antes de habilitar GEO_TRUSTED_INGRESS.
