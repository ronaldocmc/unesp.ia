import { cleanText, parseFeed } from './core.mjs'
import { publisherURL, isGoogleNewsLink } from './google-news.mjs'
import { googleNewsCacheKey, googleRetrySeconds, createSharedGoogleResolver } from './google-news-cache.mjs'
import { downloadFeed, downloadRadarPage, requestRadarJSON } from './feed-network.mjs'
import { extractRadarPageMetadata } from './page-metadata.mjs'

export const resolutionText = value => cleanText(value, 500).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function resolutionDomain(value) {
  if (typeof value !== 'string') return null
  try {
    const input = new URL(value.includes('://') ? value : `https://${value}/news`)
    input.pathname = '/news'
    const url = publisherURL(input.href)
    return url ? new URL(url).hostname.replace(/^www\./, '') : null
  } catch { return null }
}
const inDomain = (url, domain) => {
  const host = resolutionDomain(url)
  return !!host && !!domain && (host === domain || host.endsWith('.' + domain))
}
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
function titleOf(value, vehicle) {
  let title = resolutionText(value), suffix = resolutionText(vehicle)
  if (suffix && title.endsWith(' ' + suffix)) title = title.slice(0, -suffix.length).trim()
  return title
}
export function resolutionTitleScore(a, b, vehicle = '') {
  const x = titleOf(a, vehicle), y = titleOf(b, vehicle)
  if (!x || !y || x.length < 12 || y.length < 12) return 0
  if (x === y) return 1
  const first = new Set(x.split(' ')), second = new Set(y.split(' '))
  // Evita tratar negação ou números diferentes como mera variação de manchete.
  const numbers = text => (text.match(/\b\d+\b/g) || []).sort().join('|')
  if (numbers(x) !== numbers(y) || ['nao','sem','contra'].some(word => first.has(word) !== second.has(word))) return 0
  if (Math.min(first.size, second.size) < 6) return 0
  return 2 * [...first].filter(word => second.has(word)).length / (first.size + second.size)
}
export function matchResolution(item, candidates, domain) {
  if (!validDay(item.data) || item.data_confirmada === false || !domain) return null
  const matches = (Array.isArray(candidates) ? candidates : []).filter(candidate => candidate && publisherURL(candidate.url) && inDomain(candidate.url, domain)
    && validDay(candidate.data) && candidate.data === item.data && resolutionTitleScore(item.titulo, candidate.titulo, item.veiculo) >= .94)
  const urls = [...new Set(matches.map(candidate => publisherURL(candidate.url)))]
  return urls.length === 1 ? urls[0] : null // Ambiguidade não vira confirmação.
}
function matchingFeeds(feeds, item) {
  const vehicle = resolutionText(item.veiculo), hint = resolutionDomain(item.dominio_veiculo)
  return feeds.filter(feed => {
    const domain = resolutionDomain(feed.dominio)
    if (!domain || !resolutionDomain(feed.url)) return false
    if (hint && domain === hint) return true
    const names = [feed.nome, feed.instituicao, ...(feed.aliases || '').split(',')].map(resolutionText).filter(Boolean)
    return !!vehicle && names.some(name => name === vehicle || name.startsWith(vehicle + ' '))
  }).slice(0, 2)
}

// Fallback pequeno, conferido nas páginas oficiais; não inventa domínios pelo nome.
// https://agenciabrasil.ebc.com.br/ | https://obia.nic.br/ | https://www.tse.jus.br/
const resolutionKnownPublishers = [
  { nomes: ['Agência Brasil', 'AgenciaBrasil'], dominio: 'agenciabrasil.ebc.com.br' },
  { nomes: ['Observatório Brasileiro de Inteligência Artificial', 'OBIA', 'Observatório IA RNP'], dominio: 'obia.nic.br' },
  { nomes: ['Tribunal Superior Eleitoral', 'TSE'], dominio: 'tse.jus.br' },
]
export function resolutionPublisherDomain(item, feeds = [], vehicles = [], allowKnown = true) {
  const hint = resolutionDomain(item.dominio_veiculo)
  if (hint) return hint
  const feedDomains = [...new Set(feeds.map(feed => resolutionDomain(feed.dominio)).filter(Boolean))]
  if (feedDomains.length === 1) return feedDomains[0]
  const name = resolutionText(item.veiculo)
  const registered = [...new Set(vehicles.filter(row => resolutionText(row.nome) === name)
    .map(row => resolutionDomain(row.url)).filter(Boolean))]
  if (registered.length) return registered.length === 1 ? registered[0] : null
  const known = allowKnown && resolutionKnownPublishers.find(row => row.nomes.some(value => resolutionText(value) === name))
  if (known) return known.dominio
  // Alguns RSS usam o próprio hostname como nome do veículo.
  return typeof item.veiculo === 'string' && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(item.veiculo)
    ? resolutionDomain(item.veiculo) : null
}
export async function registerResolutionItems(db, items) {
  const data = items.filter(item => googleNewsCacheKey(item.google_news_url || item.link) || publisherURL(item.link)).slice(0, 300).map(item => ({ url_rss: item.google_news_url || item.link,
    url_original: item.google_news_url ? publisherURL(item.link) : null,
    titulo: cleanText(item.titulo, 300), veiculo: cleanText(item.fonte?.origem || item.fonte || '', 200), data: item.data,
    data_confirmada: item.data_confirmada === true, dominio_veiculo: item.dominio_veiculo || null }))
  if (!data.length) return
  const result = await db.rpc('observatorio_resolucao_registrar', { p_itens: data })
  if (result.error || result.data?.ok !== true) throw new Error('Metadados de resolução indisponíveis.')
}

// Reaproveita a leitura normal da coleta: indexação nunca faz outra requisição.
export async function indexOfficialFeed(db, feed, items) {
  const domain = resolutionDomain(feed.dominio_veiculo)
  if (!feed.resolucao_oficial || !domain || !feed.id) return
  const docs = items.filter(item => item.data_confirmada && inDomain(item.link, domain)).slice(0, 100)
    .map(item => ({ url: publisherURL(item.link), titulo: item.titulo, data: item.data, veiculo: feed.nome || feed.origem }))
  const result = await db.rpc('observatorio_resolucao_documentos', { p_feed: feed.id, p_itens: docs })
  if (result.error || result.data?.ok !== true) throw new Error('Índice oficial indisponível.')
}

export function createURLResolutionService({ db, env = {}, readPage = downloadRadarPage, download = downloadFeed,
  jsonRequest = requestRadarJSON, fetchImpl = fetch, now = () => new Date(), googleResolver,
  log = event => console.info(JSON.stringify({ evento: 'radar_url_resolucao', ...event })) }) {
  async function metric(method, state, status, start) {
    const event = { metodo: method, estado: state, http_status: status || null, duracao_ms: Math.max(0, Date.now() - start) }
    try { await db.rpc('observatorio_resolucao_evento', { p_metodo: method, p_estado: state, p_http: event.http_status, p_duracao: event.duracao_ms }) } catch { /* Métrica não interrompe coleta/resolução. */ }
    try { log(event) } catch { /* Não loga URLs, títulos, corpos, tokens ou chaves. */ }
  }
  return async (input, { onAttempt = () => {}, somenteCache = false, reservationToken = null } = {}) => {
    const link = typeof input === 'string' ? input : input.link
    const direct = publisherURL(link)
    if (!isGoogleNewsLink(link)) return { url: direct, metodo: direct ? 'direto' : 'pendente', status: direct ? 'resolvido' : 'pendente' }
    const key = googleNewsCacheKey(link), deferred = []
    let attempted = false, reason = 'Nenhuma correspondência verificável.', context
    const attempt = () => { attempted = true; onAttempt() }
    const contextResult = await db.rpc('observatorio_resolucao_contexto', { p_chave: key })
    if (contextResult.error || contextResult.data?.ok !== true) return { url: null, metodo: 'pendente', status: 'indisponivel', motivo: 'Atualize a migration radar_resolucao_inteligente.' }
    context = contextResult.data
    const item = context.contexto || {}, feeds = matchingFeeds(Array.isArray(context.feeds) ? context.feeds : [], item)
    let domain = resolutionPublisherDomain(item, feeds, [], false)
    const cached = publisherURL(context.cache)
    if (cached && (!domain || inDomain(cached, domain))) return { url: cached, metodo: 'cache', status: 'resolvido', consultou: false }
    if (somenteCache) return { url: null, metodo: 'pendente', status: 'pendente', consultou: false }
    const waiting = async (message, status = 'aguardando_dados') => {
      await metric('pendente', status, null, Date.now())
      return { url: null, metodo: 'pendente', status, motivo: message, consultou: false,
        retomar_em: new Date(now().getTime() + 6 * 3600000).toISOString() }
    }
    if (!item.titulo || resolutionText(item.titulo).length < 12) return waiting('Título ausente ou insuficiente; aguardando dados da notícia, sem consumir tentativa.')
    if (!validDay(item.data) || item.data_confirmada === false) return waiting('Data de publicação ausente ou não confirmada; aguardando dados do RSS, sem consumir tentativa.')
    if (!domain) {
      try {
        const registry = await db.from('observatorio_veiculos').select('nome,url').eq('ativo', true).order('nome').limit(300)
        if (!registry.error && Array.isArray(registry.data)) domain = resolutionPublisherDomain(item, feeds, registry.data)
      } catch { /* Cadastro indisponível não bloqueia o fallback validado por veículo. */ }
      domain ||= resolutionPublisherDomain(item, feeds)
    }
    if (!domain && !resolutionText(item.veiculo)) return waiting('Veículo e domínio ausentes; aguardando dados da fonte, sem consumir tentativa.')
    const deadline = Date.now() + 42000
    async function guarded(url, method, operation, interval = 900, daily = 100, countAttempt = true) {
      const origin = new URL(url).origin, start = Date.now()
      if (Date.now() >= deadline) return null
      let result
      try { result = await db.rpc('observatorio_resolucao_origem_iniciar', { p_origem: origin, p_intervalo: interval, p_limite: daily }) }
      catch { reason = 'Controle de acesso ao provedor indisponível; nenhum novo acesso autorizado.'; deferred.push(new Date(now().getTime() + 300000).toISOString()); return null }
      if (result.error || result.data?.ok !== true) {
        reason = result.error ? 'Controle de acesso ao provedor indisponível; nenhum novo acesso autorizado.' : 'Aguardando intervalo, cota ou pausa compartilhada do provedor.'
        if (result.data?.retomar_em) deferred.push(result.data.retomar_em)
        else deferred.push(new Date(now().getTime() + 300000).toISOString())
        await metric(method, 'aguardar', null, start); return null
      }
      const token = result.data.token
      let status = 200, wait = null
      try { if (countAttempt) attempt(); const value = await operation(); await metric(method, 'consultado', 200, start); return value }
      catch (error) {
        status = Number.isInteger(error?.httpStatus) ? error.httpStatus : 503
        wait = googleRetrySeconds(error?.retryAfter, now().getTime())
        if ([403,429,503].includes(status)) deferred.push(new Date(now().getTime() + Math.max(60, wait) * 1000).toISOString())
        reason = `${method}: HTTP ${status}; sem resultado confirmado.`
        await metric(method, 'falha', status, start)
        return null
      } finally {
        try { await db.rpc('observatorio_resolucao_origem_finalizar', { p_origem: origin, p_token: token, p_http: status, p_espera: wait }) } catch { /* Lease expira e continua bloqueando concorrência. */ }
      }
    }
    const resolved = async (url, metodo) => { await metric(metodo, 'resolvido', null, Date.now()); return { url, metodo, status: 'resolvido', consultou: attempted } }
    // 1. Conteúdo já identificado no banco, por título + veículo/domínio + data.
    if (domain && validDay(item.data)) {
      try {
        const found = await db.rpc('observatorio_resolucao_existentes', { p_data: item.data, p_dominio: domain })
        const match = matchResolution(item, found.data?.itens || [], domain)
        if (match) return resolved(match, 'banco')
      } catch { /* Prossegue sem interromper a coleta. */ }
    }
    // 2. Índice de feeds oficiais, depois leitura limitada de até dois feeds cadastrados.
    for (const feed of feeds) {
      const feedDomain = resolutionDomain(feed.dominio)
      let indexed = []
      try { indexed = (await db.rpc('observatorio_resolucao_documentos', { p_feed: feed.id })).data?.itens || [] } catch { /* Feed pode ainda não estar indexado. */ }
      let match = matchResolution(item, indexed, feedDomain)
      if (match) return resolved(match, 'rss_oficial')
      // Só atualiza o índice após 15 minutos; não repete a leitura em cada item.
      if (indexed.some(row => Date.parse(row.verificado_em) > now().getTime() - 900000)) continue
      const xml = await guarded(feed.url, 'rss_oficial', () => download(feed.url, 4000))
      if (typeof xml !== 'string' || xml.length > 2000000 || !/<(?:[\w-]+:)?(?:rss|feed|RDF)\b/i.test(xml)) continue
      const docs = parseFeed(xml, { origem: feed.nome }).filter(row => row.data_confirmada && inDomain(row.link, feedDomain))
        .slice(0, 100).map(row => ({ url: publisherURL(row.link), titulo: row.titulo, data: row.data, veiculo: feed.nome }))
      try { await db.rpc('observatorio_resolucao_documentos', { p_feed: feed.id, p_itens: docs }) } catch { /* Mantém resolução em memória. */ }
      match = matchResolution(item, docs, feedDomain)
      if (match) return resolved(match, 'rss_oficial')
    }
    async function verifyPage(url) {
      const target = publisherURL(url)
      const targetDomain = domain || resolutionDomain(target)
      if (!target || !targetDomain || !inDomain(target, targetDomain)) { reason = 'Destino retornado inválido ou fora do domínio do veículo.'; return null }
      const page = await guarded(target, 'pagina', () => readPage(target, 4000), 10, 200)
      if (!page) return null
      if (!inDomain(page.url, targetDomain)) { reason = 'Redirecionamento para domínio diferente; confirmação manual necessária.'; return null }
      const extracted = extractRadarPageMetadata(page.html, page.url)
      // Sem domínio previamente conhecido, exige também confirmação explícita do veículo.
      if (!domain && resolutionText(extracted.draft.fonte) !== resolutionText(item.veiculo)) {
        reason = 'Veículo não confirmado na página de destino; endereço mantido como candidato.'; return null
      }
      if (extracted.date_source === 'url' || !validDay(extracted.draft.data_publicacao)) { reason = 'Página sem data de publicação verificável; endereço mantido como candidato.'; return null }
      if (extracted.draft.data_publicacao !== item.data) { reason = 'Data da página diferente da data do RSS; revisão necessária.'; return null }
      const match = matchResolution(item, [{ url: page.url, titulo: extracted.draft.titulo, data: extracted.draft.data_publicacao }], targetDomain)
      if (!match) reason = 'Título da página não corresponde ao título do RSS; revisão necessária.'
      return match
    }
    // 3. API opcional, endpoint fixo e chave apenas no header; não usa LLM.
    if (env.RADAR_URL_SEARCH_PROVIDER === 'brave' && env.BRAVE_SEARCH_API_KEY && domain && item.titulo && validDay(item.data) && item.data_confirmada !== false) {
      const endpoint = new URL('https://api.search.brave.com/res/v1/web/search')
      endpoint.searchParams.set('q', `site:${domain} "${cleanText(item.titulo, 200)}"`)
      endpoint.searchParams.set('count', '3')
      const daily = Math.max(1, Math.min(100, Math.floor(Number(env.RADAR_URL_SEARCH_DAILY_LIMIT) || 10)))
      const data = await guarded(endpoint.href, 'busca', () => jsonRequest(endpoint.href, { headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY } }, 4000, { fetchImpl }), 60, daily)
      const candidates = (Array.isArray(data?.web?.results) ? data.web.results : []).filter(row => row && inDomain(row.url, domain) && resolutionTitleScore(item.titulo, row.title, item.veiculo) >= .94).slice(0, 2)
      const matches = []
      for (const candidate of candidates) { const checked = await verifyPage(candidate.url); if (checked) matches.push(checked) }
      if (new Set(matches).size === 1) return resolved(matches[0], 'busca')
    }
    // 4. Último recurso: decoder JavaScript/Deno existente, sem serviço externo adicional.
    const mode = env.RADAR_URL_DECODER_PROVIDER || 'legacy'
    // O feed oficial é opcional. Sem domínio cadastrado, a página deve confirmar também o veículo.
    const verifiable = !!(domain || resolutionText(item.veiculo))
    let decoded
    const decoderMethod = 'google_legado'
    const previousCandidate = publisherURL(context.candidata)
    if (verifiable && previousCandidate && (!domain || inDomain(previousCandidate, domain))
      && context.candidata_metodo === decoderMethod) {
      // Se só a página do veículo falhou, não repete a decodificação já concluída.
      decoded = previousCandidate
    } else if (verifiable && mode === 'legacy' && Date.now() < deadline) {
      const resolve = googleResolver || createSharedGoogleResolver({ db, readPage, fetchImpl, now })
      decoded = await guarded('https://news.google.com/articles/resolution', decoderMethod, async () => {
        let blocked
        const value = await resolve(link, {
          timeoutMs: 5000, persistOriginal: false, onAttempt: attempt, onDiagnostic: value => { reason = value },
          onState: state => { if (state.retomar_em) deferred.push(state.retomar_em); if (state.origem === 'pausa') blocked = state.retomar_em },
        })
        if (blocked) throw Object.assign(new Error('Pausa Google compartilhada.'), { httpStatus: 429, retryAfter: blocked })
        return value
      }, 60, 100, false)
    }
    if (decoded && publisherURL(decoded) && (!domain || inDomain(decoded, domain))) {
      if (decoded !== previousCandidate) {
        try { await db.rpc('observatorio_resolucao_candidata', { p_chave: key, p_url: publisherURL(decoded), p_metodo: decoderMethod, p_token: reservationToken }) } catch { /* A confirmação final ainda precisa persistir o resultado. */ }
      }
      const verified = await verifyPage(decoded); if (verified) return resolved(verified, decoderMethod)
    }
    else if (decoded) reason = 'Destino retornado inválido ou fora do domínio do veículo.'
    if (!attempted && !deferred.length) return waiting(
      mode !== 'legacy' && !previousCandidate
        ? 'Nenhum provedor disponível para este item: decodificação desativada e nenhuma correspondência local. Sem consumir tentativa.'
        : reason === 'Nenhuma correspondência verificável.' ? 'Nenhuma consulta externa autorizada nesta rodada; aguardando dados ou configuração, sem consumir tentativa.' : reason,
      'aguardando_configuracao')
    const retry = deferred.filter(value => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b))[0]
    await metric('pendente', 'nao_resolvido', null, Date.now())
    return { url: null, metodo: 'pendente', status: 'pendente', motivo: reason, consultou: attempted, retomar_em: retry || null }
  }
}
