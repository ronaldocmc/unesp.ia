export const CATALOGO_FEEDS = [
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

export class RadarError extends Error {
  constructor(message, status = 422) { super(message); this.status = status }
}

const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
export function decode(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || match
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })
}

export function cleanText(value = '', max = 1200) {
  return decode(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim().slice(0, max)
}

function tagValue(xml, tag) {
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

function linkFromEntry(xml) {
  const rssLink = tagValue(xml, 'link')
  if (rssLink && !rssLink.startsWith('<')) return rssLink
  const atom = /<link\b[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/i.exec(xml)
  return decode(atom?.[1] || atom?.[2] || '').trim()
}

export function normalizeDate(value, fallback = new Date()) {
  if (!value) return fallback.toISOString().slice(0, 10)
  const parsed = new Date(cleanText(value, 200))
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

export function categoryToType(categoria) {
  return {
    pesquisa: 'Pesquisa',
    noticia: 'Notícia monitorada',
    aplicacao: 'Tecnologia',
    regulacao: 'Regulação',
  }[categoria] || 'Notícia monitorada'
}

export function parseFeed(xml, fonte) {
  const blocks = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)].map(match => match[0])
  return blocks.map(block => {
    const link = linkFromEntry(block)
    const titulo = cleanText(tagValue(block, 'title'), 300)
    const resumo = cleanText(tagValue(block, 'description') || tagValue(block, 'summary') || tagValue(block, 'content'), 1200)
    const data = normalizeDate(tagValue(block, 'pubDate') || tagValue(block, 'published') || tagValue(block, 'updated'))
    return { link, titulo, resumo, data, fonte }
  }).filter(item => item.link && item.titulo)
}

export function toConteudo(item) {
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

export function dedupeByLink(items, existingLinks = []) {
  const seen = new Set(existingLinks.map(link => String(link).trim().toLowerCase()))
  const result = []
  for (const item of items) {
    const key = String(item.link || item.url || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

export function selectCatalog(requested) {
  if (!Array.isArray(requested) || !requested.length) return CATALOGO_FEEDS
  const wanted = new Set(requested.map(value => String(value).toLowerCase()))
  return CATALOGO_FEEDS.filter(feed => wanted.has(feed.origem.toLowerCase()) || wanted.has(feed.categoria.toLowerCase()) || wanted.has(feed.url.toLowerCase()))
}
