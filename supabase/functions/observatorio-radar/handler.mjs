import { CATALOGO_FEEDS, RadarError, dedupeByLink, parseFeed, selectCatalog, toConteudo } from './core.mjs'
import { radarOptions, searchGemini } from './gemini.mjs'

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

async function fetchFeed(feed, timeoutMs, fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(feed.url, { signal: controller.signal, headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'ObservarIA-Radar/1.0 (+https://ia.fct.unesp.br/observatorio.html)',
    } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const xml = await response.text()
    if (xml.length > 2000000) throw new Error('Feed muito grande')
    return { ok: true, feed, items: parseFeed(xml, feed) }
  } catch (error) { return { ok: false, feed, error: error instanceof Error ? error.message : 'Falha ao ler feed', items: [] } }
  finally { clearTimeout(timer) }
}

export function createRadarHandler({ createClient, env, fetchImpl = fetch, now = () => new Date() }) {
  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
    try {
      await authorize(req, env, createClient)
      const body = await readBody(req)
      const options = radarOptions(body)
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new RadarError('Credenciais do Supabase não configuradas.', 503)
      let candidates
      let details
      if (options.modo === 'gemini') {
        const result = await searchGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, options, fetchImpl, now: now() })
        candidates = result.items
        const { items, ...metadata } = result
        details = { ...metadata, modelo: env.GEMINI_MODEL }
      } else {
        const feeds = selectCatalog(body.fontes)
        if (!feeds.length) throw new RadarError('Nenhuma fonte corresponde à seleção.', 400)
        const results = await Promise.all(feeds.map(feed => fetchFeed(feed, options.timeout_ms, fetchImpl)))
        candidates = results.flatMap(result => result.items.slice(0, options.limite_por_feed)).slice(0, options.limite_total)
        details = { feeds_catalogados: CATALOGO_FEEDS.length, feeds_processados: feeds.length,
          feeds_com_erro: results.filter(result => !result.ok).map(result => ({ origem: result.feed.origem, erro: result.error })) }
      }
      let inserted = []
      let unique = []
      if (candidates.length) {
        const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
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
