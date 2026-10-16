import { requireRole, supabase, showMessage } from './supabase.js'

const form = document.querySelector('[data-radar-form]')
const message = document.querySelector('[data-radar-message]')
let authorized = false
let busy = false

function syncMode() {
  const gemini = form.elements.modo.value === 'gemini'
  document.querySelector('[data-radar-feeds]').hidden = gemini
  document.querySelector('[data-radar-gemini]').hidden = !gemini
  form.elements.consulta.required = gemini
  form.elements.consulta.disabled = !gemini
  form.elements.dias.disabled = !gemini
  form.elements.limite_por_feed.disabled = gemini
  form.elements.limite_total.max = gemini ? '20' : '300'
  if (Number(form.elements.limite_total.value) > Number(form.elements.limite_total.max)) form.elements.limite_total.value = form.elements.limite_total.max
  form.querySelectorAll('[name="fonte"]').forEach(input => { input.disabled = gemini })
}

function sourceLink(list, label, value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
    const li = document.createElement('li')
    const link = document.createElement('a')
    link.href = url.href
    link.textContent = label
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    li.append(link)
    list.append(li)
  } catch { /* Links inválidos nunca são inseridos na página. */ }
}

function render(result) {
  document.querySelector('[data-radar-results]').hidden = false
  document.querySelector('[data-radar-summary]').textContent = `${result.candidatos} candidatos, ${result.duplicados} duplicados e ${result.inseridos} novos registros para revisão.`
  const reasons = result.descartados || {}
  document.querySelector('[data-radar-discarded]').textContent = Object.keys(reasons).length
    ? `Descartados: ${reasons.sem_fonte_verificavel || 0} sem fonte verificável, ${reasons.sem_data_valida || 0} sem data válida, ${reasons.fora_do_periodo || 0} fora do período e ${reasons.incompletos || 0} incompletos.` : ''
  const errors = document.querySelector('[data-radar-errors]')
  errors.replaceChildren()
  for (const failure of result.feeds_com_erro || []) {
    const li = document.createElement('li')
    li.textContent = `${failure.origem}: ${failure.erro}`
    errors.append(li)
  }
  const list = document.querySelector('[data-radar-items]')
  list.replaceChildren()
  for (const item of result.itens || []) sourceLink(list, item.titulo, item.url)
  const citations = document.querySelector('[data-radar-citation-list]')
  citations.replaceChildren()
  for (const source of result.fontes_gemini || []) sourceLink(citations, source.titulo, source.url)
  document.querySelector('[data-radar-citations]').hidden = !(result.fontes_gemini || []).length
  const suggestions = document.querySelector('[data-radar-search-suggestions]')
  suggestions.replaceChildren()
  for (const html of result.sugestoes_busca || []) {
    const frame = document.createElement('iframe')
    frame.title = 'Sugestões da busca Google'
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox')
    frame.referrerPolicy = 'no-referrer'
    frame.style.cssText = 'width:100%;height:180px;border:0'
    frame.srcdoc = html
    suggestions.append(frame)
  }
}

form.elements.modo.addEventListener('change', syncMode)
form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!authorized || busy) return
  const body = { modo: form.elements.modo.value, limite_total: Number(form.elements.limite_total.value) }
  if (body.modo === 'gemini') {
    body.consulta = form.elements.consulta.value.trim()
    body.dias = Number(form.elements.dias.value)
  } else {
    body.limite_por_feed = Number(form.elements.limite_por_feed.value)
    body.fontes = [...form.querySelectorAll('[name="fonte"]:checked')].map(input => input.value)
  }
  busy = true
  const controls = [...form.querySelectorAll('input, select, button')]
  controls.forEach(control => { control.disabled = true })
  document.querySelector('[data-radar-results]').hidden = true
  showMessage(message, 'Buscando conteúdos para curadoria. Aguarde a conclusão...', 'info')
  try {
    const { data, error } = await supabase.functions.invoke('observatorio-radar', { body })
    if (error || data?.error) {
      let detail = data?.error
      if (!detail && error?.context?.json) {
        try { detail = (await error.context.json()).error } catch { /* Falhas de rede podem não retornar JSON. */ }
      }
      throw new Error(detail || 'Não foi possível executar o Radar. Confira se a função foi atualizada no Supabase.')
    }
    if (!data?.ok || data.modo !== body.modo) throw new Error('Atualize a função observatorio-radar no Supabase para habilitar os dois modos.')
    render(data)
    showMessage(message, 'Execução concluída. Os novos registros aguardam curadoria.', 'success')
  } catch (error) { showMessage(message, error.message, 'error') }
  finally { busy = false; controls.forEach(control => { control.disabled = false }); syncMode() }
})
document.querySelector('[data-logout]').addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.href = 'login.html'
})

for (const control of form.querySelectorAll('input, select, button')) control.disabled = true
try {
  await requireRole(['administrador', 'observatorio_admin', 'observatorio_curador'], { message: 'Esta área é exclusiva da equipe de curadoria do Observatório.' })
  // O catálogo público contém apenas URLs de feeds, sem credenciais de execução.
  const response = await fetch('assets/data/radar-fontes.json?v=20261016')
  if (!response.ok) throw new Error('Não foi possível carregar o catálogo de fontes.')
  const sources = await response.json()
  const container = document.querySelector('[data-radar-sources]')
  for (const source of sources) {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'; input.name = 'fonte'; input.value = source.origem
    label.append(input, document.createTextNode(source.origem))
    container.append(label)
  }
  authorized = true
  form.querySelectorAll('input, select, button').forEach(control => { control.disabled = false })
  syncMode()
} catch (error) { showMessage(message, error.message, 'error') }
