import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CATALOGO_FEEDS, RadarError, dedupeByLink, parseFeed, selectCatalog, toConteudo } from './core.mjs'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-radar-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: cors })
}

function authorize(req: Request) {
  const expected = Deno.env.get('RADAR_AGENT_TOKEN')
  if (!expected) throw new RadarError('RADAR_AGENT_TOKEN não configurado.', 500)
  const token = req.headers.get('x-radar-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (token !== expected) throw new RadarError('Execução não autorizada.', 401)
}

async function readBody(req: Request) {
  if (!req.headers.get('content-type')?.includes('application/json')) return {}
  const text = await req.text()
  if (!text.trim()) return {}
  if (text.length > 4096) throw new RadarError('Solicitação muito grande.', 413)
  try { return JSON.parse(text) } catch { throw new RadarError('JSON inválido.', 400) }
}

async function fetchFeed(feed: { url: string; origem: string; categoria: string }, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'User-Agent': 'ObservarIA-Radar/1.0 (+https://ia.fct.unesp.br/observatorio.html)',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const xml = await response.text()
    return { ok: true, feed, items: parseFeed(xml, feed) }
  } catch (error) {
    return { ok: false, feed, error: error instanceof Error ? error.message : 'Falha ao ler feed', items: [] }
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  try {
    authorize(req)
    const body = await readBody(req) as { fontes?: string[]; limite_por_feed?: number; limite_total?: number; timeout_ms?: number }
    const feeds = selectCatalog(body.fontes)
    const limitPerFeed = Math.max(1, Math.min(Number(body.limite_por_feed || 5), 20))
    const totalLimit = Math.max(1, Math.min(Number(body.limite_total || 80), 300))
    const timeoutMs = Math.max(3000, Math.min(Number(body.timeout_ms || 12000), 30000))

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) throw new RadarError('Credenciais do Supabase não configuradas.', 500)
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    const results = await Promise.all(feeds.map(feed => fetchFeed(feed, timeoutMs)))
    const candidates = results.flatMap(result => result.items.slice(0, limitPerFeed)).slice(0, totalLimit)
    const candidateLinks = [...new Set(candidates.map(item => item.link).filter(Boolean))]
    const { data: existing, error: selectError } = await supabase
      .from('observatorio_conteudos')
      .select('url')
      .in('url', candidateLinks.length ? candidateLinks : [''])
    if (selectError) throw selectError

    const unique = dedupeByLink(candidates, (existing || []).map(row => row.url))
    const payload = unique.map(toConteudo)
    let inserted = []
    if (payload.length) {
      const { data, error } = await supabase.from('observatorio_conteudos').insert(payload).select('id,titulo,url,fonte')
      if (error) throw error
      inserted = data || []
    }

    return json({
      ok: true,
      agente: 'radar',
      feeds_catalogados: CATALOGO_FEEDS.length,
      feeds_processados: feeds.length,
      feeds_com_erro: results.filter(result => !result.ok).map(result => ({ origem: result.feed.origem, erro: result.error })),
      candidatos: candidates.length,
      duplicados: candidates.length - unique.length,
      inseridos: inserted.length,
      itens: inserted,
    })
  } catch (error) {
    const status = error instanceof RadarError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Falha ao executar Agente Radar.' }, status)
  }
})
