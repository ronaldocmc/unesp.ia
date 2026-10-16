// Regras de formulário; permissões e validação da conexão continuam no banco/servidor.
export function validateFeedDraft(draft) {
  const value = { ...draft }
  value.codigo = String(value.codigo || '').trim()
  value.nome = String(value.nome || '').trim()
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(value.codigo)) throw new Error('Código: use até 100 letras minúsculas, números e hífens, sem espaços.')
  if (!value.nome || value.nome.length > 200) throw new Error('Informe um nome com até 200 caracteres.')
  let url
  try { url = new URL(value.url_feed) } catch { throw new Error('Informe a URL HTTPS pública do feed RSS/Atom.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') ||
    /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || /(^|\.)(localhost|local|internal|lan|test|invalid)$/.test(url.hostname) || url.href.length > 2048) {
    throw new Error('Use HTTPS público, sem senha, endereço IP ou porta personalizada.')
  }
  url.hash = ''; value.url_feed = url.href
  if (!['ia','tecnologia','geral'].includes(value.escopo)) throw new Error('Escolha um escopo válido.')
  if (!['pesquisa','noticia','aplicacao','regulacao'].includes(value.categoria)) throw new Error('Escolha uma categoria válida.')
  value.prioridade = Number(value.prioridade)
  if (!Number.isInteger(value.prioridade) || value.prioridade < 1 || value.prioridade > 3) throw new Error('Prioridade: use 1 (alta), 2 (média) ou 3 (baixa).')
  return value
}

export function radarSourceSelection(mode, selected) {
  if (mode === 'todas') return [] // Contrato da função: todas as fontes ativas.
  if (mode !== 'escolher' || !selected.length) throw new Error('Selecione pelo menos uma fonte ou escolha “Todas as fontes ativas”.')
  return [...new Set(selected)]
}
