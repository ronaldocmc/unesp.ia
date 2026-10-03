import { requireSession, supabase, showMessage } from './supabase.js'

const $ = selector => document.querySelector(selector)
const message = $('[data-submit-message]')
const linkMessage = $('[data-link-preview-message]')
const linkForm = $('[data-link-preview-form]')
const form = $('[data-observation-form]')
let session

function normalizeLink(value) {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Informe um link HTTP ou HTTPS válido, sem credenciais.')
  url.hash = ''
  return url.href
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fillDraft(draft = {}) {
  for (const [name, value] of Object.entries(draft)) {
    if (!form.elements[name] || value == null) continue
    form.elements[name].value = value
  }
  if (!form.elements.data_publicacao.value) form.elements.data_publicacao.value = today()
}

async function previewLink(event) {
  event.preventDefault()
  const buttons = linkForm.querySelectorAll('button')
  buttons.forEach(button => { button.disabled = true })
  showMessage(linkMessage, 'Buscando dados públicos da fonte...', 'info')
  try {
    const url = normalizeLink(linkForm.elements.source_url.value.trim())
    const { data, error } = await supabase.functions.invoke('observatorio-link', { body: { url } })
    if (error || data?.error) {
      let detail = data?.error
      if (!detail && error?.context?.json) {
        try { detail = (await error.context.json()).error } catch { /* Network errors may not expose JSON. */ }
      }
      throw new Error(detail || 'Não foi possível importar este link. Preencha os dados manualmente.')
    }
    fillDraft({ ...data.draft, origem: 'Usuário identificado', status: 'revisao', revisao_humana: false })
    showMessage(linkMessage, `Dados carregados para revisão. ${(data.warnings || []).join(' ')}`, 'success')
  } catch (error) { showMessage(linkMessage, error.message, 'error') }
  finally { buttons.forEach(button => { button.disabled = false }) }
}

function payloadFromForm() {
  const fd = new FormData(form)
  const url = normalizeLink(String(fd.get('url') || '').trim())
  const image = String(fd.get('imagem_url') || '').trim()
  return {
    colecao: 'Observatório',
    tipo: String(fd.get('tipo') || '').trim(),
    categoria: String(fd.get('categoria') || '').trim(),
    titulo: String(fd.get('titulo') || '').trim(),
    resumo: String(fd.get('resumo') || '').trim(),
    data_publicacao: String(fd.get('data_publicacao') || today()).trim(),
    url,
    imagem_url: image ? normalizeLink(image) : null,
    palavras_chave: String(fd.get('palavras_chave') || '').trim() || null,
    fonte: String(fd.get('fonte') || '').trim(),
    observacao_colaborador: String(fd.get('observacao_colaborador') || '').trim() || null,
    origem: 'Usuário identificado',
    status: 'revisao',
    destaque: false,
    revisao_humana: false,
    submetido_por: session.user.id,
    submetido_email: session.user.email || null,
  }
}

async function submitObservation(event) {
  event.preventDefault()
  const buttons = form.querySelectorAll('button')
  buttons.forEach(button => { button.disabled = true })
  showMessage(message, 'Enviando para curadoria...', 'info')
  try {
    const payload = payloadFromForm()
    const { error } = await supabase.from('observatorio_conteudos').insert(payload)
    if (error) throw error
    form.reset()
    linkForm.reset()
    form.elements.data_publicacao.value = today()
    showMessage(message, 'Sugestão enviada. Ela ficará em revisão até a curadoria aprovar, editar ou arquivar.', 'success')
  } catch (error) { showMessage(message, error.message, 'error') }
  finally { buttons.forEach(button => { button.disabled = false }) }
}

$('[data-clear-preview]').addEventListener('click', () => {
  linkForm.reset()
  showMessage(linkMessage, 'Formulário limpo. Você pode preencher manualmente.', 'info')
})
linkForm.addEventListener('submit', previewLink)
form.addEventListener('submit', submitObservation)

try {
  session = await requireSession(location.href)
  $('[data-logout]').hidden = false
  $('[data-logout]').addEventListener('click', async () => {
    await supabase.auth.signOut()
    location.href = 'observatorio.html'
  })
  form.elements.data_publicacao.value = today()
  showMessage(message, `Você está enviando como ${session.user.email || 'usuário autenticado'}.`, 'info')
} catch (error) {
  if (message) showMessage(message, error.message, 'error')
}
