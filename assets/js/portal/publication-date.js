// Datas de publicação: preserva o dia informado pela fonte, sem converter fusos.
export function validPublicationDate(value) {
  if (typeof value !== 'string') return ''
  const date = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(value.trim())?.[1] || ''
  return date && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : ''
}

export function publicationDateFromURL(value) {
  let url
  try { url = new URL(value) } catch { return '' }
  if (!['http:', 'https:'].includes(url.protocol)) return ''
  // Só sugere datas no caminho de uma matéria; ignora query strings e arquivos de datas.
  const matches = [...url.pathname.matchAll(/\/(\d{4})[/-](\d{2})[/-](\d{2})(?=\/[^/]+)/g)]
  if (matches.length !== 1) return ''
  return validPublicationDate(`${matches[0][1]}-${matches[0][2]}-${matches[0][3]}`)
}

function samePage(reference, pageURL) {
  if (typeof reference !== 'string') return false
  try {
    const url = new URL(reference, pageURL)
    const page = new URL(pageURL)
    return url.origin === page.origin && url.pathname.replace(/\/$/, '') === page.pathname.replace(/\/$/, '')
  } catch { return false }
}

function structuredPublicationDate(html, pageURL) {
  const articles = []
  function collect(value) {
    if (Array.isArray(value)) { value.forEach(collect); return }
    if (!value || typeof value !== 'object') return
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    if (types.some(type => typeof type === 'string' && /^(?:https?:\/\/schema\.org\/)?(?:Article|NewsArticle|BlogPosting|TechArticle|ScholarlyArticle|Report|AnalysisNewsArticle|OpinionNewsArticle|ReportageNewsArticle)$/.test(type))) articles.push(value)
    collect(value['@graph'])
    collect(value.mainEntity)
  }
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json(?=\s|$))/i.test(match[1])) continue
    try { collect(JSON.parse(match[2])) } catch { /* Um bloco inválido não impede a leitura dos demais. */ }
  }
  const candidates = articles.map(article => {
    const refs = [article.url, article['@id'], article.mainEntityOfPage?.['@id'],
      typeof article.mainEntityOfPage === 'string' ? article.mainEntityOfPage : null].filter(value => typeof value === 'string')
    return { date: validPublicationDate(article.datePublished), matched: refs.some(ref => samePage(ref, pageURL)), unscoped: refs.length === 0 }
  }).filter(candidate => candidate.date)
  const matching = candidates.filter(candidate => candidate.matched)
  if (matching.length) return new Set(matching.map(candidate => candidate.date)).size === 1 ? matching[0].date : ''
  const unscoped = candidates.filter(candidate => candidate.unscoped)
  return unscoped.length === 1 ? unscoped[0].date : ''
}

export function selectPublicationDate(html, pageURL, metadata = {}) {
  const structured = structuredPublicationDate(html, pageURL)
  const meta = ['article:published_time', 'datepublished', 'pubdate', 'date']
    .map(key => validPublicationDate(metadata[key])).find(Boolean) || ''
  if (structured) return { date: structured, source: 'structured', conflict: Boolean(meta && meta !== structured) }
  if (meta) return { date: meta, source: 'metadata', conflict: false }
  const date = publicationDateFromURL(pageURL)
  return { date, source: date ? 'url' : 'none', conflict: false }
}
