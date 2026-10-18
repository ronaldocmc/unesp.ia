import { decodeGoogleNewsID, isGoogleNewsLink, resolveGoogleNewsLink, publisherURL } from './google-news.mjs'

export function googleNewsCacheKey(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'news.google.com' || url.username || url.password || url.port) return null
    const id = url.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]+)$/)?.[1]
    const key = id && `https://news.google.com/articles/${id}`
    return key && key.length <= 2048 ? key : null
  } catch { return null }
}

export function googleRetrySeconds(value, nowMs = Date.now()) {
  if (typeof value === 'string' && value.trim()) {
    const text = value.trim()
    const seconds = /^\d+$/.test(text) ? Number(text) : (Date.parse(text) - nowMs) / 1000
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(2147483647, Math.max(1, Math.ceil(seconds)))
  }
  return 900
}

export function createSharedGoogleResolver({ db, readPage, fetchImpl, now = () => new Date(), resolve = resolveGoogleNewsLink }) {
  return async (link, { onDiagnostic = () => {}, onState = () => {}, somenteCache = false, timeoutMs = 8000 } = {}) => {
    if (!isGoogleNewsLink(link)) return link
    const fail = (reason, state = {}) => { onDiagnostic(reason); onState(state); return null }
    const key = googleNewsCacheKey(link)
    if (!key) return fail('identificador inválido')
    // Offline IDs do not contact Google and need no shared network slot.
    const legacy = decodeGoogleNewsID(link)
    if (legacy) { onState({ origem: 'offline' }); return legacy }
    let started
    try {
      const result = await db.rpc('observatorio_google_link_iniciar', { p_chave: key, p_somente_cache: somenteCache })
      if (result.error || !result.data) throw new Error('Cache unavailable')
      started = result.data
    } catch { return fail('Cache e pausa indisponíveis. Execute a migration radar_google_cache antes de converter novos links.') }
    if (started.situacao === 'cache') {
      const cached = publisherURL(started.url)
      if (!cached) return fail('Cache retornou um endereço original inválido.')
      onState({ origem: 'cache' }); return cached
    }
    if (started.situacao === 'pausa' || started.situacao === 'aguardar') {
      const retomar = typeof started.retomar_em === 'string' && Number.isFinite(Date.parse(started.retomar_em))
        ? new Date(started.retomar_em).toISOString() : null
      return fail(started.situacao === 'pausa'
        ? `Pausa compartilhada após HTTP 429${retomar ? ` até ${retomar}` : ''}. Nenhum novo acesso ao Google foi feito.`
        : 'Aguarde o intervalo de segurança ou a conversão em andamento. Nenhum novo acesso ao Google foi feito.',
      { origem: started.situacao, retomar_em: retomar })
    }
    if (somenteCache || started.situacao === 'pendente') return fail('Conversão pendente: abra a revisão para identificar o endereço original.', { origem: 'pendente' })
    if (started.situacao !== 'consultar' || typeof started.token !== 'string') return fail('Cache e pausa retornaram uma resposta inválida.')
    let original = null, reason = 'conversão não concluída', wait = null
    try {
      original = await resolve(link, { readPage, fetchImpl, timeoutMs,
        onDiagnostic: value => { reason = value },
        onRateLimit: value => { wait = googleRetrySeconds(value, now().getTime()) },
      })
      original = original && publisherURL(original)
    } catch { reason = 'rede ou validação: falha no resolvedor' }
    // Never retry a 429. Persist its cooldown before handling the next request.
    if (wait !== null) original = null
    try {
      const finished = await db.rpc('observatorio_google_link_finalizar', {
        p_chave: key, p_token: started.token, p_url: original || null, p_espera_segundos: wait,
      })
      if (finished.error || finished.data?.ok !== true) throw new Error('Cache unavailable')
      if (wait !== null) return fail('Google HTTP 429: pausa compartilhada registrada. Nenhuma retentativa automática foi feita.',
        { origem: 'pausa', retomar_em: finished.data.retomar_em || null })
    } catch { return fail('Não foi possível registrar o cache ou a pausa compartilhada. Nenhuma retentativa foi feita.') }
    onState({ origem: 'internet' })
    if (!original) onDiagnostic(reason)
    return original || null
  }
}
