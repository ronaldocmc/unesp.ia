import { cleanText } from './core.mjs'

// Pontos por conceito e campo, não por repetição. A escala indica pertinência temática,
// nunca qualidade editorial, veracidade ou confiança na fonte.
export const SCORE_MINIMO_IA = 4
const strong = [
  'inteligencia artificial', 'artificial intelligence', 'generative ai', 'genai',
  'machine learning', 'deep learning', 'large language models?', 'language models?', 'llms?',
  'transformers?', 'neural networks?', 'redes? neurais?', 'ai agents?', 'agentes? de ia', 'agentic ai',
]
const iaEntities = ['openai', 'chatgpt', 'gpt(?:[- .]?\\d[\\w.-]*)?', 'anthropic', 'claude', 'gemini',
  'google deepmind', 'deepseek', 'mistral', 'llama', 'hugging face', 'copilot', 'perplexity', 'grok']
const normalize = value => cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const matches = (text, term) => new RegExp(`(^|[^a-z0-9])(?:${term})(?=$|[^a-z0-9])`, 'i').test(text)

export function scoreIA(item) {
  const title = normalize(item.titulo || '')
  const summary = normalize(item.resumo || '')
  let score = 0
  for (const term of strong) score += (matches(title, term) ? 5 : 0) + (matches(summary, term) ? 2 : 0)
  for (const term of iaEntities) score += (matches(title, term) ? 4 : 0) + (matches(summary, term) ? 1 : 0)
  // Siglas somente como palavras inteiras, acompanhadas de contexto tecnológico.
  const context = /\b(modelos?|models?|chatbots?|generativ\w*|algoritm\w*|automatiz\w*|intelig\w*|comput\w*|agents?|agentes?|tecnolog\w*)\b/
  if (context.test(`${title} ${summary}`)) score += (matches(title, 'ai|ia') ? 5 : 0) + (matches(summary, 'ai|ia') ? 2 : 0)
  return score
}

export function classificarRelevancia(score) {
  return score >= 80 ? 'alta' : score >= 60 ? 'relevante' : score >= 40 ? 'revisar' : 'baixa'
}

export function avaliarRelevanciaIA(item, fonte, minimo = SCORE_MINIMO_IA) {
  const score_bruto = scoreIA(item)
  const valid = Boolean(item.titulo?.trim() && item.link?.trim())
  const relevancia_ia = fonte.escopo === 'ia' ? Math.max(90, Math.min(100, score_bruto * 10)) : Math.min(100, score_bruto * 10)
  const threshold = fonte.escopo === 'geral' ? minimo + 1 : minimo
  return { aceito: valid && (fonte.escopo === 'ia' || score_bruto >= threshold), score_bruto,
    relevancia_ia, classificacao: classificarRelevancia(relevancia_ia) }
}
