// Versão arquivo único para colar no Supabase Web como index.ts da função observatorio-radar.
// Antes de executar:
// 1) Rode a migration 202610060001_observatorio_agente_radar.sql no SQL Editor.
// 2) Cadastre o secret RADAR_AGENT_TOKEN em Edge Functions > Secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CATALOGO_FEEDS = [
  { url: 'https://huggingface.co/blog/feed.xml', origem: 'Hugging Face', categoria: 'pesquisa' },
  { url: 'https://blog.google/technology/ai/rss/', origem: 'Google AI', categoria: 'pesquisa' },
  { url: 'https://openai.com/news/rss.xml', origem: 'OpenAI', categoria: 'pesquisa' },
  { url: 'https://news.mit.edu/rss/topic/artificial-intelligence', origem: 'MIT News', categoria: 'pesquisa' },
  { url: 'https://bair.berkeley.edu/blog/feed.xml', origem: 'BAIR (Berkeley)', categoria: 'pesquisa' },
  { url: 'https://www.anthropic.com/feed.xml', origem: 'Anthropic News', categoria: 'pesquisa' },
  { url: 'https://www.anthropic.com/engineering/feed.xml', origem: 'Anthropic Engineering', categoria: 'pesquisa' },
  { url: 'https://github.com/deepseek-ai.atom', origem: 'DeepSeek Releases', categoria: 'pesquisa' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', origem: 'TechCrunch', categoria: 'noticia' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', origem: 'The Verge', categoria: 'noticia' },
  { url: 'https://venturebeat.com/category/ai/feed/', origem: 'VentureBeat', categoria: 'noticia' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', origem: 'Ars Technica', categoria: 'noticia' },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', origem: 'MIT Tech Review', categoria: 'noticia' },
  { url: 'https://simonwillison.net/atom/everything/', origem: 'Simon Willison', categoria: 'aplicacao' },
  { url: 'https://www.latent.space/feed', origem: 'Latent Space', categoria: 'aplicacao' },
  { url: 'https://www.marktechpost.com/feed/', origem: 'MarkTechPost', categoria: 'pesquisa' },
  { url: 'https://tecnoblog.net/feed/', origem: 'Tecnoblog', categoria: 'noticia' },
  { url: 'https://canaltech.com.br/rss/', origem: 'Canaltech', categoria: 'noticia' },
  { url: 'https://g1.globo.com/rss/g1/tecnologia/', origem: 'G1 Tecnologia', categoria: 'noticia' },
  { url: 'https://jornal.usp.br/?s=observatorio&feed=rss2', origem: 'USP (Observatório)', categoria: 'regulacao' },
  { url: 'https://jornal.usp.br/tag/inteligencia-artificial/feed/', origem: 'USP (IA)', categoria: 'pesquisa' },
  { url: 'https://jornal.unesp.br/?s=observatorio&feed=rss2', origem: 'UNESP (Observatório)', categoria: 'regulacao' },
  { url: 'https://jornal.unesp.br/tag/inteligencia-artificial/feed/', origem: 'UNESP (IA)', categoria: 'pesquisa' },
  { url: 'https://www.unicamp.br/noticias/?s=observatorio&feed=rss2', origem: 'UNICAMP (Observatório)', categoria: 'regulacao' },
]

class RadarError extends Error {
  status: number
  constructor(message: string, status = 422) {
    super(message)
    this.status = status
  }
}

const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }

function decode(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || match
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })
}

function cleanText(value = '', max = 1200) {
  return decode(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim().slice(0, max)
}

function tagValue(xml: string, tag: string) {
  const patterns = [
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
    new RegExp(`<[^:>]+:${tag}\\b[^>]*>([\\s\\S]*?)<\\/[^:>]+:${tag}>`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(xml)
    if (match) return decode(match[1]).trim()
  }
  return ''
}

function linkFromEntry(xml: string) {
  const rssLink = tagValue(xml, 'link')
  if (rssLink && !rssLink.startsWith('<')) return rssLink
  const atom = /<link\b[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/i.exec(xml)
  return decode(atom?.[1] || atom?.[2] || '').trim()
}

function normalizeDate(value: string, fallback = new Date()) {
  if (!value) return fallback.toISOString().slice(0, 10)
  const parsed = new Date(cleanText(value, 200))
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function categoryToType(categoria: string) {
  return ({
    pesquisa: 'Pesquisa',
    noticia: 'Notícia monitorada',
    aplicacao: 'Tecnologia',
    regulacao: 'Regulação',
  } as Record<string, string>)[categoria] || 'Notícia monitorada'
}

function parseFeed(xml: string, fonte: { url: string; origem: string; categoria: string }) {
  const blocks = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)].map(match => match[0])
  return blocks.map(block => {
    const link = linkFromEntry(block)
    const titulo = cleanText(tagValue(block, 'title'), 300)
    const resumo = cleanText(tagValue(block, 'description') || tagValue(block, 'summary') || tagValue(block, 'content'), 1200)
    const data = normalizeDate(tagValue(block, 'pubDate') || tagValue(block, 'published') || tagValue(block, 'updated'))
    return { link, titulo, resumo, data, fonte }
  }).filter(item => item.link && item.titulo)
}

function toConteudo(item: ReturnType<typeof parseFeed>[number]) {
  const fonte = item.fonte
  const resumo = item.resumo || `Conteúdo identificado pelo Agente Radar a partir da fonte ${fonte.origem}. Revise e complemente antes de publicar.`
  return {
    colecao: 'Observatório',
    tipo: categoryToType(fonte.categoria),
    categoria: fonte.categoria,
    titulo: item.titulo,
    resumo,
    data_publicacao: item.data,
    url: item.link,
    fonte: fonte.origem,
    origem: 'Agente Radar',
    agente_origem: 'radar',
    agente_processado_em: new Date().toISOString(),
    status: 'revisao',
    destaque: false,
    revisao_humana: false,
    aprovado_curadoria: false,
    palavras_chave: `radar, ${fonte.categoria}, ${fonte.origem}`,
  }
}

function dedupeByLink(items: ReturnType<typeof parseFeed>, existingLinks: string[] = []) {
  const seen = new Set(existingLinks.map(link => String(link).trim().toLowerCase()))
  const result = []
  for (const item of items) {
    const key = String(item.link || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function selectCatalog(requested: unknown) {
  if (!Array.isArray(requested) || !requested.length) return CATALOGO_FEEDS
  const wanted = new Set(requested.map(value => String(value).toLowerCase()))
  return CATALOGO_FEEDS.filter(feed => wanted.has(feed.origem.toLowerCase()) || wanted.has(feed.categoria.toLowerCase()) || wanted.has(feed.url.toLowerCase()))
}

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
