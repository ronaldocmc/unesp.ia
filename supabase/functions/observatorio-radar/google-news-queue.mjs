import { RadarError } from './core.mjs'
import { isGoogleNewsLink, publisherURL } from './google-news.mjs'
import { googleNewsCacheKey, createSharedGoogleResolver } from './google-news-cache.mjs'
import { registerResolutionItems } from './url-resolution.mjs'

export async function enqueueGoogleLinks(db, links) {
  const urls = [...new Set(links.filter(isGoogleNewsLink))]
  if (!urls.length) return { ok: true, itens: [] }
  const result = await db.rpc('observatorio_google_fila_adicionar', { p_urls: urls.slice(0, 300) })
  if (result.error || result.data?.ok !== true || !Array.isArray(result.data.itens)) throw new RadarError('Fila de links indisponível. Aplique a migration radar_google_fila.', 503)
  return result.data
}

export async function enqueueGoogleItems(db, items) {
  try { await registerResolutionItems(db, items) } catch { /* Migração antiga: coleta e fila anteriores continuam disponíveis. */ }
  const result = await enqueueGoogleLinks(db, items.map(item => item.link))
  const mappings = new Map(result.itens.map(item => [item.chave, publisherURL(item.url)]))
  for (const item of items) {
    const original = mappings.get(googleNewsCacheKey(item.link))
    if (!original) continue
    item.google_news_url = item.link
    item.link = original
    if (item.observacao_colaborador?.startsWith('Link do Google Notícias')) delete item.observacao_colaborador
  }
  return result
}

export async function processGoogleQueue({ db, readPage, fetchImpl, now, resolver, smartResolver }) {
  const reserved = await db.rpc('observatorio_google_fila_reservar')
  if (reserved.error || !reserved.data?.situacao) throw new RadarError('Não foi possível reservar a fila. Confira a migration radar_google_fila.', 503)
  const job = reserved.data
  // Não envia tokens de reserva ao chamador; estados sem trabalho não acessam rede.
  if (job.situacao !== 'processar') return { situacao: job.situacao, processados: 0, retomar_em: job.retomar_em || null }
  if (!googleNewsCacheKey(job.chave) || typeof job.token !== 'string') throw new RadarError('Reserva de fila inválida.', 503)
  let consulted = false, state = {}, reason = 'Conversão não concluída.'
  let method = null
  let url = publisherURL(job.url_original)
  if (!url && smartResolver) {
    try {
      const result = await smartResolver(job.chave, { reservationToken: job.token, onAttempt: () => { consulted = true } })
      url = publisherURL(result.url); method = result.metodo || 'pendente'; reason = result.motivo || reason
      state = { retomar_em: result.retomar_em }
      // Uma rodada sem evidência/configuração também termina no limite de tentativas;
      // espera por cota/pausa não consome tentativa adicional.
      if (!url && !result.retomar_em && result.status !== 'indisponivel') consulted = true
    } catch { reason = 'Resolução inteligente indisponível; coleta preservada.'; method = 'pendente' }
  } else if (!url) {
    const resolve = resolver || createSharedGoogleResolver({ db, readPage, fetchImpl, now })
    try {
      url = await resolve(job.chave, { timeoutMs: 8000, onAttempt: () => { consulted = true },
        onDiagnostic: value => { reason = value }, onState: value => { state = value } })
      url = publisherURL(url)
    } catch { reason = 'Falha controlada ao converter o link.' }
  }
  const retryAt = typeof state.retomar_em === 'string' && Number.isFinite(Date.parse(state.retomar_em)) ? state.retomar_em : null
  const finished = await db.rpc(smartResolver ? 'observatorio_resolucao_finalizar' : 'observatorio_google_fila_finalizar', { p_chave: job.chave, p_token: job.token,
    p_url: url || null, ...(smartResolver ? { p_metodo: method || 'cache' } : {}), p_consultou: consulted, p_retomar: retryAt, p_motivo: String(reason).slice(0, 300) })
  if (finished.error || finished.data?.ok !== true) throw new RadarError('Não foi possível concluir a reserva da fila. Nenhum conteúdo foi publicado.', 503)
  return { situacao: finished.data.estado, processados: 1, resolvidos: url ? 1 : 0,
    atualizados: finished.data.aplicacao?.atualizados || 0, conflitos: finished.data.aplicacao?.conflitos || 0,
    tentativas: finished.data.tentativas, retomar_em: url ? null : finished.data.proxima_em }
}
