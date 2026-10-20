// Deterministic search: no fetch, embeddings, API credentials or LLM calls.
export const conversationNormalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const stop = new Set('a o as os um uma uns umas de da do das dos em na no nas nos por para pelo pela pelos pelas e ou sobre com que qual quais quando como onde quem tem temos voces voce eu me meu minha gostaria quero queria saber mostre mostrar busque buscar pesquise pesquisar encontre encontrar ver veja diga conte traga ha sao foi foram ser esta estao esse essa esses essas este esta neste nesta dessa disso mais recentes recente ultimas ultimos ultima ultimo publicacoes publicacao conteudos conteudo noticias noticia reportagens reportagem pesquisas pesquisa artigos artigo estudos estudo dados indicadores indicador regulacao regulamentacao legislacao leis lei avaliacoes avaliacao benchmarks benchmark aplicacoes aplicacao ferramentas ferramenta inteligencia artificial ia hoje ontem semana mes ano dias dia meses neste nesta nessa nesse nessa semana hoje ontem compare comparar explique explicar analise analisar resuma resumir impactos impacto implicacoes quais acervo observatorio favor porfavor'.split(/\s+/))
const types = [
  ['noticias', /\b(noticias?|reportagens?)\b/, /noticia|midia|tv|jornal|radio/],
  ['pesquisas', /\b(pesquisas?|artigos?|estudos?|teses?|dissertacoes)\b/, /pesquisa|artigo|tese|dissertacao/],
  ['regulacao', /\b(regulacao|regulamentacao|legislacao|leis|lei)\b/, /regula|legisla|politica|norma/],
  ['dados', /\b(dados|indicadores?)\b/, /dados|indicador|dataset/],
  ['avaliacoes', /\b(avaliacoes|avaliacao|benchmarks?)\b/, /avalia|benchmark/],
  ['aplicacoes', /\b(aplicacoes|aplicacao|ferramentas?)\b/, /aplica|tecnologia|ferramenta/],
]
const synonyms = { educacao: ['educa','ensin','escol','aprendizagem'], saude: ['saude','medicina','medic','hospital','clinica'], regulacao: ['regula','legisla','governanca'] }
for (const word of ['sabemos', 'existe', 'existem', 'relacionado', 'relacionados', 'relacionada', 'relacionadas', 'teses', 'tese', 'dissertacoes', 'dissertacao', 'agora', 'somente', 'apenas']) stop.add(word)
for (const word of ['pode', 'podem', 'poderia', 'poderiam', 'ajuda', 'ajudar', 'contribui', 'contribuir', 'impacta', 'afeta', 'uso', 'usada', 'usado', 'usando']) stop.add(word)

export function conversationToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-')
}
const shiftDay = (day, delta) => new Date(Date.parse(day + 'T12:00:00Z') + delta * 86400000).toISOString().slice(0, 10)

export function parseConversationQuestion(question, { now = new Date(), previous = null } = {}) {
  const text = conversationNormalize(question).trim()
  const today = conversationToday(now)
  const followup = /^(e\b|agora\b|somente\b|apenas\b)/.test(text)
  const tipo = types.find(([, pattern]) => pattern.test(text))?.[0] || (followup ? previous?.tipo : null) || null
  let desde = null, ate = null, periodo = 'Todo o período', warning = null
  const days = /\bultim[oa]s?\s+(\d{1,4})\s+dias?\b/.exec(text)
  const year = /\bem\s+(20\d{2})\b/.exec(text)
  if (days) {
    const count = Number(days[1])
    if (count < 1 || count > 365) warning = 'Use um período entre 1 e 365 dias.'
    else { desde = shiftDay(today, 1 - count); ate = today; periodo = `Últimos ${count} dias` }
  } else if (/\bontem\b/.test(text)) { desde = ate = shiftDay(today, -1); periodo = 'Ontem' }
  else if (/\bhoje\b/.test(text)) { desde = ate = today; periodo = 'Hoje' }
  else if (/\b(nesta|essa|esta) semana\b/.test(text)) { desde = shiftDay(today, -6); ate = today; periodo = 'Últimos 7 dias' }
  else if (/\b(neste|esse|este) mes\b/.test(text)) { desde = today.slice(0, 7) + '-01'; ate = today; periodo = 'Mês atual' }
  else if (/\b(neste|esse|este) ano\b/.test(text)) { desde = today.slice(0, 4) + '-01-01'; ate = today; periodo = 'Ano atual' }
  else if (year) { desde = year[1] + '-01-01'; ate = year[1] + '-12-31'; periodo = `Ano ${year[1]}` }
  else if (followup && previous?.desde) { ({ desde, ate, periodo } = previous) }
  const cleaned = text.replace(/\bultim[oa]s?\s+\d+\s+dias?\b/g, ' ').replace(/\bem\s+20\d{2}\b/g, ' ')
  let terms = [...new Set(cleaned.split(/[^a-z0-9]+/).filter(word => word.length > 1 && !stop.has(word) && !/^\d+$/.test(word)))].slice(0, 10)
  if (followup && !terms.length && previous?.terms) terms = previous.terms.slice(0, 10)
  const analysis = /\b(compar|expliqu|analis|resum|impact|implicac)/.test(text)
  return { tipo, terms, desde, ate, periodo, warning, analysis }
}

export function conversationItem(row) {
  let href = null
  try {
    const url = new URL(row.href || row.url)
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) href = url.href
  } catch { /* Invalid URLs are not rendered as links. */ }
  return {
    id: String(row.id || '').slice(0, 80), titulo: String(row.titulo || '').slice(0, 300),
    resumo: String(row.resumo || '').slice(0, 1200), tipo: String(row.tipo || '').slice(0, 80),
    categoria: String(row.categoria || '').slice(0, 80), data: String(row.data || row.data_publicacao || '').slice(0, 10),
    fonte: String(row.fonte || row.veiculo || '').slice(0, 200), href,
    tags: (Array.isArray(row.tags) ? row.tags : String(row.palavras_chave || '').split(',')).slice(0, 30).map(value => String(value).slice(0, 80)),
  }
}

export function searchConversation(items, question, options = {}) {
  const filters = parseConversationQuestion(question, options)
  const normalized = conversationNormalize(question).trim()
  if (/^(oi|ola|bom dia|boa tarde|boa noite|ajuda)[!?.\s]*$/.test(normalized)) return { filtros: filters, fontes: [], total: 0,
    resposta: 'Olá! Posso localizar conteúdos publicados do Observatório. Experimente: “Notícias sobre educação nos últimos 7 dias” ou “Pesquisas sobre saúde”. No modo sem LLM, uso regras e filtros, não produzo análises inéditas.', interpretacao: 'Orientação sobre a busca' }
  if (/\bcomo\b.*\b(funciona|usar)\b.*\bradar\b/.test(normalized)) return { filtros: filters, fontes: [], total: 0,
    resposta: 'O Agente Radar coleta fontes RSS e oferece busca por APIs de LLM. As fontes RSS podem ser habilitadas separadamente para coleta manual e automática. Os conteúdos passam por curadoria humana antes da publicação.', interpretacao: 'Informação sobre o Agente Radar' }
  if (filters.warning) return { filtros: filters, fontes: [], total: 0, resposta: filters.warning, interpretacao: 'Período não reconhecido' }
  const typePattern = types.find(([key]) => key === filters.tipo)?.[2]
  const scored = items.map(conversationItem).filter(item => item.titulo).flatMap(item => {
    if (typePattern && !typePattern.test(conversationNormalize(item.tipo + ' ' + item.categoria))) return []
    if (filters.desde && (!item.data || item.data < filters.desde || item.data > filters.ate)) return []
    const title = conversationNormalize(item.titulo)
    const words = conversationNormalize([item.titulo,item.resumo,item.fonte,...item.tags].join(' ')).split(/[^a-z0-9]+/)
    const groups = filters.terms.map(term => synonyms[term] || [term])
    if (!groups.every(group => group.some(term => words.some(word => word === term || (term.length >= 4 && word.startsWith(term)))))) return []
    const score = filters.terms.reduce((sum, term) => sum + (title.includes(term) ? 3 : 1), 0)
    return [{ item, score }]
  }).sort((a, b) => b.score - a.score || b.item.data.localeCompare(a.item.data))
  const interpretacao = `${filters.tipo || 'Todos os tipos'} · ${filters.terms.length ? filters.terms.join(', ') : 'Todos os temas'} · ${filters.periodo}`
  const fontes = scored.slice(0, 6).map(({ item }) => item)
  const explanation = filters.analysis ? 'Sem LLM, posso localizar fontes, mas não comparar ou gerar análises. ' : ''
  return { filtros: filters, fontes, total: scored.length, interpretacao,
    resposta: explanation + (fontes.length ? `Encontrei ${scored.length} conteúdo(s) publicado(s). Mostro até 6 resultados para você conferir.`
      : 'Não encontrei conteúdo publicado com esses filtros. Tente outro termo ou um período maior. Isso não significa que não existam estudos sobre o tema fora do acervo.') }
}
