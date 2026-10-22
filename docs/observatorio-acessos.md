# Estatísticas de acesso do Observar.IA

## Ativação

1. Execute no SQL Editor do Supabase o arquivo completo `supabase/migrations/202610220001_observatorio_acessos.sql` (pode ser reaplicado).
2. Publique os arquivos de frontend alterados, incluindo os dois novos módulos `.mjs`. Não requer deploy de Edge Function nem alteração de secrets.
3. Abra `observatorio.html` sem automação, em uma aba visível. Desça até um cartão e mantenha ao menos metade dele visível por um segundo. Clique na fonte.
4. Como administrador, abra Administração do Observatório → Estatísticas de acesso do Observar.IA → Consultar acessos. Curadores comuns não têm acesso ao relatório.
5. Recarregue a aba pública e consulte de novo: a mesma sessão não deve duplicar a visita nem o mesmo evento de uma publicação no mesmo dia. Uma nova sessão conta após 30 minutos sem interação registrada. Outra aba pode contar separadamente.

## Critérios e privacidade

- Visita: sessão anônima por aba/dia, com expiração após 30 minutos sem interação registrada, no horário de Brasília. Não representa pessoas únicas. A aba pública oculta não registra visita até ficar visível.
- Visualização: cartão do acervo ao menos 50% visível por um segundo contínuo com documento visível; não comprova leitura do texto no veículo. Navegadores sem IntersectionObserver não registram impressões.
- Cliques: abertura por clique normal ou botão central nos links do cartão, uma vez por sessão/dia/conteúdo/tipo. O link Google é separado como fallback; não é apresentado como clique confirmado no original. Ações via menu de contexto não são medidas.
- Não são armazenados nome, login, e-mail, IP, user-agent, referrer, URL completa ou identificador persistente de visitante. O navegador guarda um UUID aleatório em sessionStorage com expiração lógica. Recibos diários de deduplicação são eliminados após dois dias quando houver novo evento válido; permanecem os totais agregados.
- A requisição de rede, como qualquer acesso web, pode aparecer nos logs de infraestrutura do provedor. Não significa ausência de logs de IP pelo Supabase/servidor.
- Respeita Do Not Track, Global Privacy Control e `navigator.webdriver`. Não envia eventos a partir do painel ou do Radar. Se um administrador visitar a página pública, conta como visitante; não há consulta de identidade para rastreamento.
- Falhas na gravação não impedem navegação ou abertura da fonte. Usa somente chave publicável e RPC restrita; tabelas privadas sem leitura/escrita direta pública. Relatórios exigem `private.is_observatorio_admin()` no banco, não apenas ocultação visual.
- RPC aceita somente eventos definidos e IDs publicados/revisados, com deduplicação atômica e limite de 500 eventos por sessão/dia. Endpoint anônimo não garante proteção contra fraude: um robô pode trocar UUIDs. Para uso de alto tráfego, configure proteção de borda/rate limit e considere um serviço dedicado. Não use os números como auditoria ou faturamento.
- Contagens entre domínios (GitHub Pages e domínio Unesp) não deduplicam visitantes entre si; não há rastreamento cruzado. Meses no relatório são limitados ao intervalo escolhido (máximo de 367 dias).
- Não há histórico retroativo, publicação de notícias, alteração de fila RSS ou alteração das regras de curadoria.
