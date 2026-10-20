import { searchConversation, conversationItem } from './observatorio-conversa-model.js?v=20261020-textos'

const node = (tag, text, className) => {
  const item = document.createElement(tag)
  if (text) item.textContent = text
  if (className) item.className = className
  return item
}
let instance
export function openConversation(getSnapshot) {
  if (!instance) instance = createConversation(getSnapshot)
  if (!instance.open) instance.showModal()
}
function createConversation(getSnapshot) {
  const dialog = node('dialog', '', 'obs-dialog obs-conversation')
  dialog.setAttribute('aria-labelledby', 'conversation-title')
  const close = node('button', '×', 'obs-dialog-close'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar conversa')
  const title = node('h2', 'Converse com o Observar.IA'); title.id = 'conversation-title'
  const intro = node('p', 'Encontre notícias, pesquisas e outros conteúdos do Observatório. Diga o tema que procura e, se desejar, indique um período. Os resultados trazem links para você consultar as fontes.')
  const form = node('form'), controls = node('div', '', 'obs-conversation-controls')
  const mode = node('select'); mode.id = 'conversation-mode'
  for (const [value, text] of [['local', 'Buscar no acervo'], ['llm', 'Consultar com inteligência artificial']]) { const option = node('option', text); option.value = value; mode.append(option) }
  const modeLabel = node('label', 'Modo de consulta'); modeLabel.htmlFor = mode.id; modeLabel.append(mode)
  const provider = node('select'); provider.id = 'conversation-provider'
  for (const [value, text] of [['groq', 'Groq'], ['gemini', 'Gemini']]) { const option = node('option', text); option.value = value; provider.append(option) }
  const providerLabel = node('label', 'Serviço de inteligência artificial'); providerLabel.htmlFor = provider.id; providerLabel.append(provider); providerLabel.hidden = true
  controls.append(modeLabel, providerLabel)
  const consent = node('input'); consent.type = 'checkbox'
  const consentLabel = node('label', '', 'obs-conversation-consent'); consentLabel.append(consent, document.createTextNode('Autorizo o envio da minha pergunta, de até 4 mensagens anteriores e de trechos do acervo ao serviço escolhido. Esta opção consome tokens e pode gerar custos na conta da API, conforme o plano. Não envie informações pessoais ou sigilosas.')); consentLabel.hidden = true
  const login = node('a', 'Entrar para consultar com IA'); login.href = 'login.html?returnTo=' + encodeURIComponent('observatorio.html#agentes'); login.hidden = true
  const limits = node('p', 'A IA prepara uma resposta com base em títulos e resumos do acervo, sem pesquisar na internet. É necessário entrar na sua conta. Há limites de uso; confira sempre as informações nas fontes.'); limits.hidden = true
  const examples = node('p', 'Experimente: “Notícias sobre educação nos últimos 7 dias”, “Pesquisas sobre saúde” ou “Regulação neste ano”.')
  const messages = node('div', '', 'obs-conversation-messages'); messages.setAttribute('aria-label', 'Histórico desta conversa')
  const status = node('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  const input = node('textarea'); input.id = 'conversation-question'; input.maxLength = 1000; input.rows = 3; input.required = true
  const label = node('label', 'Sua pergunta (até 1.000 caracteres)'); label.htmlFor = input.id
  const submit = node('button', 'Consultar', 'obs-button primary'); submit.type = 'submit'
  const clear = node('button', 'Limpar conversa', 'obs-button'); clear.type = 'button'
  const actions = node('div', '', 'obs-conversation-controls'); actions.append(submit, clear)
  form.append(controls, consentLabel, login, limits, label, input, actions)
  dialog.append(close, title, intro, examples, messages, status, form)
  document.body.append(dialog)
  let history = [], previous = null, busy = false
  close.addEventListener('click', () => dialog.close())
  mode.addEventListener('change', () => {
    const llm = mode.value === 'llm'
    for (const element of [providerLabel, consentLabel, login, limits]) element.hidden = !llm
    consent.required = llm
    consent.checked = false
  })
  provider.addEventListener('change', () => { consent.checked = false })
  clear.addEventListener('click', () => { history = []; previous = null; messages.replaceChildren(); status.textContent = ''; input.value = ''; input.focus() })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (busy) return
    const question = input.value.trim()
    if (!question || question.length > 1000) return
    const snapshot = getSnapshot()
    if (!snapshot.available) { status.textContent = 'O acervo ainda não está disponível. Aguarde o carregamento ou atualize a página.'; return }
    busy = true
    for (const element of [submit, clear, mode, provider, consent]) element.disabled = true
    status.textContent = 'Consultando…'
    try {
      let answer
      if (mode.value === 'local') {
        answer = searchConversation(snapshot.items, question, { previous })
      } else {
        if (!consent.checked) throw new Error('Confirme o envio ao serviço de IA antes de consultar.')
        const { supabase } = await import('./portal/supabase.js')
        if (!supabase) throw new Error('Serviço não configurado.')
        const session = await supabase.auth.getSession()
        if (session.error || !session.data?.session) throw new Error('Clique em “Entrar para consultar com IA” e faça login antes de consultar.')
        const { data, error } = await supabase.functions.invoke('observatorio-conversa', { body: { pergunta: question, provedor: provider.value, consentimento: true, historico: history.slice(-4).map(item => ({ role: item.role, content: item.content.slice(0, 500) })) } })
        if (error) {
          let message
          try { message = (await error.context?.json())?.erro } catch { /* Generic message has no credential or raw provider body. */ }
          throw new Error(message || 'A consulta com IA está indisponível no momento. Tente novamente mais tarde ou escolha “Buscar no acervo”.')
        }
        if (data?.erro || typeof data?.resposta !== 'string') throw new Error(data?.erro || 'Resposta inválida do serviço.')
        answer = data
      }
      previous = answer.filtros || previous
      const turn = node('section', '', 'obs-conversation-turn')
      turn.append(node('h3', question), node('p', answer.resposta, 'obs-conversation-answer'))
      const details = node('details')
      details.append(node('summary', 'Detalhes da consulta'))
      if (answer.interpretacao) details.append(node('small', 'Critérios da busca: ' + answer.interpretacao))
      const sources = node('ol')
      for (const raw of answer.fontes || []) {
        const item = conversationItem(raw), li = node('li'), link = item.href ? node('a', item.titulo) : node('span', item.titulo)
        if (item.href) { link.href = item.href; link.target = '_blank'; link.rel = 'noopener noreferrer' }
        li.append(link, node('small', [item.fonte, item.data].filter(Boolean).join(' · '))); sources.append(li)
      }
      if (sources.children.length) turn.append(sources)
      turn.append(node('small', answer.usou_llm ? 'Resposta elaborada com inteligência artificial. Confira as informações nas fontes.' : 'Resultados do acervo do Observatório.'))
      details.append(node('small', answer.usou_llm ? `${answer.provedor} · ${answer.modelo} · ${answer.tokens == null ? 'Consumo não informado pelo serviço' : answer.tokens + ' tokens informados pelo serviço'}` : 'Busca sem geração de texto por IA e sem consumo de tokens.'))
      turn.append(details)
      messages.append(turn)
      while (messages.children.length > 8) messages.firstElementChild.remove()
      history.push({ role: 'user', content: question }, { role: 'assistant', content: answer.resposta }); history = history.slice(-4)
      input.value = ''; status.textContent = 'Consulta concluída. Você pode fazer outra pergunta. A conversa é apagada ao recarregar a página.'
      turn.scrollIntoView({ block: 'nearest' })
    } catch (error) { status.textContent = error.message || 'Não foi possível concluir a consulta.' }
    finally { busy = false; for (const element of [submit, clear, mode, provider, consent]) element.disabled = false }
  })
  return dialog
}
