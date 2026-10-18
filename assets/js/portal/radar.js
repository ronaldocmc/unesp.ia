import { requireRole, supabase, showMessage } from './supabase.js'
import { radarSourceSelection } from './radar-model.js?v=20261016-fontes-uso'
import { initRadarCuradoria } from './radar-curadoria.js?v=20261018-diagnostico'

const form = document.querySelector('[data-radar-form]')
const message = document.querySelector('[data-radar-message]')
let authorized = false
let busy = false
let curadoria
function setBusy(value) {
  busy = value
  form.querySelectorAll('input,select,button').forEach(control => { control.disabled = value })
  if (!value) syncMode()
  curadoria?.sync()
}
curadoria = initRadarCuradoria({ canDecide: () => authorized && !busy, isBusy: () => busy, setBusy, sourceLink })
window.addEventListener('beforeunload', event => {
  if (curadoria.hasPending()) { event.preventDefault(); event.returnValue = '' }
})

function syncMode() {
  const gemini = form.elements.modo.value !== 'feeds'
  const groq = form.elements.modo.value === 'groq'
  document.querySelector('[data-radar-provider-description]').textContent = groq
    ? 'Groq descobre até 3 links com browser_search. O Radar extrai título, descrição e data das páginas, sem pedir resumo à IA. A disponibilidade da busca e os custos dependem do seu plano Groq.'
    : 'Pesquisa fontes na web com Google Search e organiza notícias com Gemini. Usa a chave configurada no servidor e pode gerar cobrança na conta Google AI.'
  document.querySelector('[data-radar-provider-help]').textContent = groq
    ? 'Links sem metadados completos ou data confirmada ficam apenas na relação de links descobertos para conferência manual. Nenhum conteúdo é publicado automaticamente.'
    : 'Matérias sem fonte citada ou sem data de publicação válida são descartadas. Datas e resumos extraídos por IA devem ser conferidos na curadoria.'
  document.querySelector('[data-radar-feeds]').hidden = gemini
  document.querySelector('[data-radar-gemini]').hidden = !gemini
  form.elements.consulta.required = gemini
  form.elements.consulta.disabled = !gemini
  form.elements.dias.disabled = !gemini
  form.elements.limite_por_feed.disabled = gemini
  form.elements.limite_total.max = groq ? '3' : gemini ? '20' : '300'
  if (Number(form.elements.limite_total.value) > Number(form.elements.limite_total.max)) form.elements.limite_total.value = form.elements.limite_total.max
  syncSources()
  form.elements.debug.disabled = gemini
}

function syncSources() {
  const gemini = form.elements.modo.value !== 'feeds'
  const all = form.elements.selecao_fontes.value === 'todas'
  const inputs = [...form.querySelectorAll('[name="fonte"]')]
  document.querySelector('[data-radar-source-options]').hidden = all
  form.querySelectorAll('[name="selecao_fontes"]').forEach(input => { input.disabled = gemini })
  inputs.forEach(input => { input.disabled = gemini || all })
  document.querySelector('[data-radar-source-count]').textContent = all
    ? `${inputs.length} fontes ativas habilitadas para busca manual serão consultadas. A seleção automática é configurada em Fontes do Radar.`
    : `${inputs.filter(input => input.checked).length} de ${inputs.length} fontes selecionadas. Marque pelo menos uma.`
}

form.querySelectorAll('[name="selecao_fontes"]').forEach(input => input.addEventListener('change', syncSources))
for (const [selector, checked] of [['[data-radar-select-all]', true], ['[data-radar-clear]', false]]) {
  document.querySelector(selector).addEventListener('click', () => {
    form.querySelectorAll('[name="fonte"]').forEach(input => { input.checked = checked })
    syncSources()
  })
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
  document.querySelector('[data-radar-summary]').textContent = `${result.candidatos} candidatos, ${result.duplicados} duplicados e ${result.previas?.length || 0} novos conteúdos em prévia. Nenhum foi salvo no acervo pela busca.`
  const reasons = result.descartados || {}
  document.querySelector('[data-radar-discarded]').textContent = result.modo === 'groq'
    ? `${result.links_descobertos || 0} links descobertos; ${result.itens_descartados_anteriormente || 0} descartados anteriormente pela curadoria. Os candidatos usam metadados das páginas; consulte os avisos e os links para conferência manual.`
    : Object.keys(reasons).length
    ? `Descartados: ${reasons.sem_fonte_verificavel || 0} sem fonte verificável, ${reasons.sem_data_valida || 0} sem data válida, ${reasons.fora_do_periodo || 0} fora do período e ${reasons.incompletos || 0} incompletos.`
    : `${result.itens_lidos || 0} itens lidos; ${result.itens_relevantes_ia || 0} relacionados a IA; ${result.itens_descartados_nao_ia || 0} descartados pelo filtro; ${result.itens_descartados_anteriormente || 0} descartados pela curadoria anteriormente; ${result.itens_fora_limites || 0} fora dos limites da execução.`
  const errors = document.querySelector('[data-radar-errors]')
  errors.replaceChildren()
  for (const failure of result.feeds_com_erro || []) {
    const li = document.createElement('li')
    li.textContent = `${failure.origem}: ${failure.erro}`
    errors.append(li)
  }
  for (const warning of result.avisos || []) {
    const li = document.createElement('li'); li.textContent = warning; errors.append(li)
  }
  const feedStats = document.querySelector('[data-radar-feed-stats]')
  feedStats.replaceChildren()
  for (const feed of result.feeds || []) {
    const li = document.createElement('li')
    li.textContent = `${feed.nome}: ${feed.status}; ${feed.lidos} lidos, ${feed.relevantes_ia} relevantes e ${feed.descartados_nao_ia} descartados.`
    feedStats.append(li)
  }
  const debug = document.querySelector('[data-radar-debug-results]')
  debug.hidden = !result.exemplos_descartados?.length
  debug.textContent = (result.exemplos_descartados || []).map(item => `${item.codigo}: ${item.titulo} — bruto ${item.score_bruto}, relevância ${item.relevancia_ia}/100 (${item.motivo})`).join('\n')
  curadoria.render(result.previas || [])
  document.querySelector('[data-radar-new-empty]').hidden = Boolean(result.previas?.length)
  const existingList = document.querySelector('[data-radar-existing]')
  existingList.replaceChildren()
  for (const item of result.itens_ja_cadastrados || []) sourceLink(existingList, item.titulo, item.url)
  const existingEmpty = document.querySelector('[data-radar-existing-empty]')
  existingEmpty.hidden = Boolean(result.itens_ja_cadastrados?.length)
  existingEmpty.textContent = !Array.isArray(result.itens_ja_cadastrados) && result.duplicados > 0
    ? 'A função não retornou os links já cadastrados. Atualize observatorio-radar no Supabase para exibir esta relação.'
    : 'Nenhum candidato desta execução já estava cadastrado no banco.'
  const batchRepeated = document.querySelector('[data-radar-batch-repeated]')
  batchRepeated.hidden = !result.repetidos_na_coleta
  batchRepeated.textContent = `${result.repetidos_na_coleta || 0} repetição(ões) adicional(is) de links novos entre os candidatos da própria coleta foram ignoradas.`
  const citations = document.querySelector('[data-radar-citation-list]')
  citations.replaceChildren()
  const sources = result.fontes_groq || result.fontes_gemini || []
  for (const source of sources) sourceLink(citations, source.titulo, source.url)
  document.querySelector('[data-radar-citations]').hidden = !sources.length
  document.querySelector('[data-radar-citation-title]').textContent = result.modo === 'groq' ? 'Links descobertos pela Groq — confira na fonte' : 'Fontes retornadas pela busca Google'
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
  if (curadoria.hasPending() && !confirm('Há conteúdos pendentes nesta prévia. Iniciar outra busca sem salvar essas pendências?')) return
  const body = { modo: form.elements.modo.value, previa: true, limite_total: Number(form.elements.limite_total.value) }
  if (body.modo !== 'feeds') {
    body.consulta = form.elements.consulta.value.trim()
    body.dias = Number(form.elements.dias.value)
  } else {
    body.limite_por_feed = Number(form.elements.limite_por_feed.value)
    body.debug = form.elements.debug.checked
    try {
      body.fontes = radarSourceSelection(form.elements.selecao_fontes.value, [...form.querySelectorAll('[name="fonte"]:checked')].map(input => input.value))
    } catch (error) { showMessage(message, error.message, 'error'); return }
  }
  setBusy(true)
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
    if (!data?.ok || data.modo !== body.modo || data.previa !== true) throw new Error('Atualize a função observatorio-radar no Supabase para habilitar a prévia sem gravação.')
    render(data)
    showMessage(message, 'Prévia concluída. Escolha o que salvar, revisar e publicar ou descartar. A busca não salvou novos conteúdos no acervo.', 'success')
  } catch (error) {
    if (curadoria.hasPending()) document.querySelector('[data-radar-results]').hidden = false
    showMessage(message, error.message + (curadoria.hasPending() ? ' A prévia anterior foi preservada.' : ''), 'error')
  }
  finally { setBusy(false) }
})
document.querySelector('[data-logout]').addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.href = 'login.html'
})

for (const control of form.querySelectorAll('input, select, button')) control.disabled = true
try {
  const session = await requireRole(['administrador', 'observatorio_admin', 'observatorio_curador'], { message: 'Esta área é exclusiva da equipe de curadoria do Observatório.' })
  const { data: role } = await supabase.from('papeis_usuario').select('papel').eq('user_id', session.user.id).single()
  document.querySelector('[data-radar-manage]').hidden = !['administrador','observatorio_admin'].includes(role?.papel)
  // A mesma função consulta o catálogo do banco sem executar a coleta.
  const { data, error } = await supabase.functions.invoke('observatorio-radar', { body: { acao: 'listar_fontes' } })
  if (error || !Array.isArray(data?.fontes)) throw new Error('Não foi possível carregar as fontes do banco. Atualize a função e execute a migration observatorio_feeds no Supabase.')
  if (data.capacidades?.previa_curadoria !== 1) throw new Error('Antes de usar esta tela, atualize observatorio-radar e execute a migration radar_curadoria. A função anterior gravava a busca automaticamente.')
  if (data.capacidades?.fontes_por_uso !== 1) throw new Error('Atualize observatorio-radar e execute a migration radar_fontes_uso para separar as fontes manuais das automáticas.')
  const sources = data.fontes
  form.elements.modo.querySelector('option[value="groq"]').disabled = data.capacidades?.groq_links !== 1
  const container = document.querySelector('[data-radar-sources]')
  for (const source of sources) {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'; input.name = 'fonte'; input.value = source.codigo
    input.addEventListener('change', syncSources)
    label.append(input, document.createTextNode(`${source.nome} (${source.escopo})`))
    container.append(label)
  }
  authorized = true
  form.querySelectorAll('input, select, button').forEach(control => { control.disabled = false })
  syncMode()
} catch (error) { showMessage(message, error.message, 'error') }
