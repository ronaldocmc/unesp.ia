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
    const publishedDate = tagValue(block, 'pubDate') || tagValue(block, 'published')
    const rawDate = publishedDate || tagValue(block, 'updated')
    const data = normalizeDate(rawDate)
    const veiculo = cleanText(tagValue(block, 'source'), 200)
    const sourceURL = /<source\b[^>]*\burl=["']([^"']+)["']/i.exec(block)?.[1]
    let dominio_veiculo = null
    try { const source = new URL(decode(sourceURL || '')); if (source.protocol === 'https:' && !source.username && !source.password) dominio_veiculo = source.hostname } catch { /* Pista opcional, nunca autorização para baixar feed arbitrário. */ }
    return { link, titulo, resumo, data, data_confirmada: !!publishedDate && Number.isFinite(Date.parse(cleanText(publishedDate, 200))), dominio_veiculo,
      fonte: veiculo && /^https:\/\/news\.google\.com\//i.test(link) ? { ...fonte, origem: veiculo } : fonte }
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
    agente_origem: item.agente_origem || 'radar',
    agente_processado_em: new Date().toISOString(),
    status: 'revisao',
    destaque: false,
    revisao_humana: false,
    aprovado_curadoria: false,
    palavras_chave: `radar, ${fonte.categoria}, ${fonte.origem}`,
    ...(Number.isInteger(item.relevancia_ia) ? { relevancia_ia: item.relevancia_ia } : {}),
    ...(item.observacao_colaborador ? { observacao_colaborador: item.observacao_colaborador } : {}),
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

export function selectCatalog(catalog, requested) {
  if (requested !== undefined && (!Array.isArray(requested) || requested.some(value => typeof value !== 'string'))) {
    throw new RadarError('fontes deve ser uma lista de códigos, nomes, categorias ou URLs.', 400)
  }
  if (!requested?.length) return catalog
  const wanted = new Set(requested.map(value => String(value).toLowerCase()))
  return catalog.filter(feed => [feed.codigo, feed.origem, feed.categoria, feed.url].some(value => wanted.has(String(value).toLowerCase())))
}
