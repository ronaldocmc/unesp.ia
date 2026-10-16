import { RadarError, dedupeByLink, parseFeed, toConteudo } from './core.mjs'
import { radarOptions, searchGemini } from './gemini.mjs'
import { carregarFeeds } from './feeds.mjs'
import { avaliarRelevanciaIA, SCORE_MINIMO_IA } from './relevance.mjs'
import { downloadFeed } from './feed-network.mjs'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-radar-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
const json = (body, status = 200) => Response.json(body, { status, headers: cors })

async function authorize(req, env, createClient) {
  const jobToken = req.headers.get('x-radar-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (env.RADAR_AGENT_TOKEN && jobToken === env.RADAR_AGENT_TOKEN) return
  const authorization = req.headers.get('authorization') || ''
  if (!/^Bearer \S+$/i.test(authorization)) throw new RadarError('Execução não autorizada.', 401)
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new RadarError('Autenticação do Supabase não configurada.', 503)
  const caller = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await caller.auth.getUser(authorization.slice(7))
  if (error || !data?.user) throw new RadarError('Sessão expirada. Entre novamente.', 401)
  const result = await caller.from('papeis_usuario').select('papel').eq('user_id', data.user.id).maybeSingle()
  if (result.error || !['administrador', 'observatorio_admin', 'observatorio_curador'].includes(result.data?.papel)) {
    throw new RadarError('Acesso restrito à equipe de curadoria do Observatório.', 403)
  }
}

async function readBody(req) {
  if (!req.headers.get('content-type')?.includes('application/json')) return {}
  const reader = req.body?.getReader()
  if (!reader) return {}
  const chunks = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.length
      if (length > 8192) { await reader.cancel(); throw new RadarError('Solicitação muito grande.', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const text = new TextDecoder().decode(bytes)
  if (!text.trim()) return {}
  try { return JSON.parse(text) } catch { throw new RadarError('JSON inválido.', 400) }
}

export async function fetchFeed(feed, timeoutMs, download = downloadFeed) {
  try {
    const xml = await download(feed.url, timeoutMs)
    if (xml.length > 2000000) throw new Error('Feed muito grande')
    if (!/<(?:[\w-]+:)?(?:rss|feed|RDF)\b/i.test(xml)) throw new Error('Resposta não é um feed RSS/Atom.')
    return { ok: true, feed, items: parseFeed(xml, feed) }
  } catch (error) { return { ok: false, feed, error: error instanceof Error ? error.message : 'Falha ao ler feed', items: [] } }
}

export function createRadarHandler({ createClient, env, fetchImpl = fetch, download = downloadFeed, now = () => new Date() }) {
  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
    try {
      await authorize(req, env, createClient)
      const body = await readBody(req)
      const options = radarOptions(body)
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new RadarError('Credenciais do Supabase não configuradas.', 503)
      const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      let candidates
      let details
      if (options.modo === 'gemini') {
        const result = await searchGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, options, fetchImpl, now: now() })
        candidates = result.items
        const { items, ...metadata } = result
        details = { ...metadata, modelo: env.GEMINI_MODEL }
      } else {
        const { feeds, ativos, catalogados } = await carregarFeeds(db, body.fontes)
        // Consulta autenticada usada pelo painel; não acessa feeds nem grava dados.
        if (body.acao === 'listar_fontes') return json({ ok: true, fontes: feeds.map(feed => ({ codigo: feed.codigo, nome: feed.nome, categoria: feed.categoria, escopo: feed.escopo, prioridade: feed.prioridade })) })
        if (!feeds.length) throw new RadarError('Nenhuma fonte corresponde à seleção.', 400)
        const configured = Number(env.RADAR_SCORE_MINIMO_IA ?? SCORE_MINIMO_IA)
        if (!Number.isInteger(configured) || configured < 1 || configured > 100) throw new RadarError('RADAR_SCORE_MINIMO_IA deve ser inteiro entre 1 e 100.', 503)
        const results = []
        // Lotes limitam conexões simultâneas; a ordem original de prioridade é preservada.
        for (let offset = 0; offset < feeds.length; offset += 4) results.push(...await Promise.all(feeds.slice(offset, offset + 4).map(feed => fetchFeed(feed, options.timeout_ms, download))))
        const stats = []; const discarded = []; const accepted = []; const warnings = []
        for (const result of results) {
          const relevant = []
          for (const item of result.items) {
            const evaluation = avaliarRelevanciaIA(item, result.feed, configured)
            if (evaluation.aceito) relevant.push({ ...item, relevancia_ia: evaluation.relevancia_ia })
            else if (body.debug === true && discarded.length < 20) discarded.push({ codigo: result.feed.codigo, titulo: item.titulo,
              score_bruto: evaluation.score_bruto, relevancia_ia: evaluation.relevancia_ia, motivo: 'pontuação abaixo do limite' })
          }
          const status = result.ok ? 'ok' : 'erro'
          const stat = { codigo: result.feed.codigo, nome: result.feed.nome, status, lidos: result.items.length,
            relevantes_ia: relevant.length, descartados_nao_ia: result.items.length - relevant.length, candidatos: Math.min(relevant.length, options.limite_por_feed),
            ...(result.error ? { erro: result.error } : {}) }
          stats.push(stat)
          accepted.push(...relevant.slice(0, options.limite_por_feed))
          // Falha no diagnóstico de uma fonte não impede a coleta das demais.
          try {
            const { error } = await db.from('observatorio_feeds').update({ ultima_execucao: now().toISOString(), ultimo_status: status,
              ultimo_erro: result.error?.slice(0, 500) || null, quantidade_lida: stat.lidos, quantidade_relevante: stat.relevantes_ia }).eq('id', result.feed.id)
            if (error) warnings.push(`Não foi possível atualizar o diagnóstico de ${result.feed.codigo}.`)
          } catch { warnings.push(`Não foi possível atualizar o diagnóstico de ${result.feed.codigo}.`) }
        }
        candidates = accepted.slice(0, options.limite_total)
        details = { feeds_catalogados: catalogados, feeds_ativos: ativos, feeds_processados: feeds.length,
          feeds_com_erro: results.filter(result => !result.ok).map(result => ({ origem: result.feed.origem, erro: result.error })),
          quantidade_feeds_com_erro: results.filter(result => !result.ok).length,
          itens_lidos: stats.reduce((sum, stat) => sum + stat.lidos, 0),
          itens_relevantes_ia: stats.reduce((sum, stat) => sum + stat.relevantes_ia, 0),
          itens_descartados_nao_ia: stats.reduce((sum, stat) => sum + stat.descartados_nao_ia, 0),
          itens_fora_limites: stats.reduce((sum, stat) => sum + stat.relevantes_ia, 0) - candidates.length,
          feeds: stats, avisos: warnings, ...(body.debug === true ? { exemplos_descartados: discarded } : {}) }
      }
      let inserted = []
      let unique = []
      if (candidates.length) {
        const links = [...new Set(candidates.map(item => item.link))]
        const { data: existing, error: selectError } = await db.from('observatorio_conteudos').select('url').in('url', links)
        if (selectError) throw new RadarError('Não foi possível conferir links existentes. Verifique as permissões do Radar no banco.', 500)
        unique = dedupeByLink(candidates, (existing || []).map(row => row.url))
        if (unique.length) {
          const { data, error } = await db.from('observatorio_conteudos').insert(unique.map(toConteudo)).select('id,titulo,url,fonte')
          if (error) throw new RadarError('Não foi possível salvar a coleta para curadoria. Verifique as permissões e o esquema do banco.', 500)
          inserted = data || []
        }
      }
      return json({ ok: true, agente: 'radar', modo: options.modo, ...details,
        candidatos: candidates.length, duplicados: candidates.length - unique.length, inseridos: inserted.length, itens: inserted })
    } catch (error) {
      return json({ error: error instanceof RadarError ? error.message : 'Falha ao executar Agente Radar.' }, error instanceof RadarError ? error.status : 500)
    }
  }
}
