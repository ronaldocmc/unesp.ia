import { supabase, showMessage } from './supabase.js'

export function initRadarCuradoria({ canDecide, setBusy, isBusy, sourceLink }) {
  const container = document.querySelector('[data-radar-preview]')
  const counts = document.querySelector('[data-radar-decisions]')
  const dialog = document.querySelector('[data-radar-editor]')
  const editor = document.querySelector('[data-radar-editor-form]')
  const editorMessage = document.querySelector('[data-radar-editor-message]')
  let entries = []
  let editing = null
  const googleNews = url => { try { return new URL(url).hostname === 'news.google.com' } catch { return false } }
  function validatedSourceURL(value) {
    const url = new URL(value)
    if (value.length > 2048 || url.protocol !== 'https:' || url.username || url.password || url.port
      || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /(^|\.)(localhost|local|internal)$/i.test(url.hostname)) {
      throw new Error('Informe o endereço HTTPS público da matéria, sem senha ou porta personalizada.')
    }
    return url.href
  }
  function refreshEntryLink(entry) {
    const draft = entry.draft
    entry.links.replaceChildren()
    sourceLink(entry.links, googleNews(draft.url) ? 'Abrir via Google Notícias — copiar endereço final para corrigir' : 'Abrir fonte original', draft.url)
    entry.metadata.textContent = `${draft.fonte || 'Fonte não informada'} · Publicação: ${draft.data_publicacao || 'Confira a data'} · ${draft.categoria}`
      + (googleNews(draft.url) ? ' · Link intermediário do Google Notícias' : '')
  }
  const labels = { revisao: 'Salvo para revisão — ainda não publicado.', publicado: 'Publicado após confirmação da revisão humana.',
    descartado: 'Descartado — não será oferecido nas próximas buscas.', ja_cadastrado: 'Já cadastrado por outra execução ou pessoa. Nenhum dado foi alterado.' }

  function sync() {
    for (const entry of entries) entry.buttons.forEach(button => { button.disabled = isBusy() || entry.status !== 'pendente' })
    dialog.querySelectorAll('button,input,textarea,select').forEach(control => { control.disabled = isBusy() })
    const count = status => entries.filter(entry => entry.status === status).length
    counts.textContent = `${count('pendente')} pendentes; ${count('revisao')} salvos para revisão; ${count('publicado')} publicados; ${count('descartado')} descartados; ${count('ja_cadastrado')} já cadastrados.`
  }

  async function resolveEntryLink(entry, draft = entry.draft) {
    if (!googleNews(draft.url)) return
    showMessage(entry.message, 'Identificando endereço original desta matéria...', 'info')
    if (editing === entry && dialog.open) showMessage(editorMessage, 'Identificando endereço original desta matéria...', 'info')
    try {
      const { data, error } = await supabase.functions.invoke('observatorio-radar', {
        // previa also prevents writes if an older function does not know this action.
        body: { acao: 'resolver_link_google', url: draft.url, previa: true, limite_total: 1 },
      })
      if (error || data?.acao !== 'resolver_link_google') throw new Error('Atualize a função observatorio-radar para habilitar a conversão individual.')
      if (!data.resolvido) throw new Error(`Conversão individual: ${data.diagnostico || 'endereço original não identificado'}.`)
      const url = new URL(data.url)
      if (url.protocol !== 'https:' || googleNews(url.href) || url.username || url.password) throw new Error('A função não retornou um endereço original válido.')
      draft.url = url.href
      entry.draft.url = url.href
      for (const value of [draft, entry.draft]) if (value.observacao_colaborador?.startsWith('Link do Google Notícias')) delete value.observacao_colaborador
      refreshEntryLink(entry)
      if (editing === entry && dialog.open) {
        editor.elements.url.value = url.href
        showMessage(editorMessage, 'Endereço original identificado. Confira os demais dados antes de publicar.', 'success')
      }
      showMessage(entry.message, 'Endereço original identificado.', 'success')
    } catch (error) {
      const text = `Link do Google Notícias — endereço original não identificado. ${error.message}`
      draft.observacao_colaborador = text; entry.draft.observacao_colaborador = text
      showMessage(entry.message, text, 'info')
      if (editing === entry && dialog.open) showMessage(editorMessage, text, 'info')
    }
  }

  async function decide(entry, action, draft = entry.draft, confirmation = false, reason = null) {
    if (!canDecide() || entry.status !== 'pendente') return
    setBusy(true); sync()
    showMessage(entry.message, 'Registrando decisão...', 'info')
    try {
      if (action !== 'descartar') await resolveEntryLink(entry, draft)
      const { data, error } = await supabase.rpc('observatorio_radar_decidir', {
        p_acao: action, p_conteudo: draft, p_confirmacao: confirmation, p_motivo: reason,
      })
      if (error) throw new Error(error.message)
      if (!labels[data?.situacao]) throw new Error('O banco não confirmou a decisão. Confira antes de tentar novamente.')
      entry.status = data.situacao
      entry.draft = draft
      entry.heading.textContent = data.item?.titulo || draft.titulo
      refreshEntryLink(entry)
      showMessage(entry.message, labels[data.situacao], 'success')
      if (editing === entry && dialog.open) dialog.close()
    } catch (error) {
      showMessage(entry.message, error.message, 'error')
      if (editing === entry && dialog.open) showMessage(editorMessage, error.message, 'error')
    } finally { setBusy(false); sync() }
  }

  async function openEditor(entry) {
    if (!canDecide() || entry.status !== 'pendente') return
    editing = entry
    for (const name of ['titulo','resumo','data_publicacao','fonte','url','categoria']) editor.elements[name].value = entry.draft[name] || ''
    editor.elements.confirmacao.checked = false
    editor.elements.confirmacao.required = false
    editorMessage.hidden = true
    if (googleNews(entry.draft.url)) showMessage(editorMessage, entry.draft.observacao_colaborador?.startsWith('Link do Google Notícias')
      ? entry.draft.observacao_colaborador : 'Link do Google Notícias — endereço original não identificado. Abra a notícia e confira o veículo antes de publicar.', 'info')
    dialog.showModal()
    if (googleNews(entry.draft.url)) {
      setBusy(true); sync()
      try { await resolveEntryLink(entry) } finally { setBusy(false); sync() }
    }
  }
  editor.addEventListener('submit', async event => {
    event.preventDefault()
    const action = event.submitter?.value || 'revisao'
    if (!['revisao','publicar'].includes(action) || !editing || !canDecide()) return
    editor.elements.confirmacao.required = action === 'publicar'
    if (!editor.reportValidity()) return
    const draft = { ...editing.draft }
    for (const name of ['titulo','resumo','data_publicacao','fonte','url','categoria']) draft[name] = editor.elements[name].value.trim()
    try { draft.url = validatedSourceURL(draft.url) }
    catch { showMessage(editorMessage, 'Informe um link HTTPS público válido para a matéria.', 'error'); return }
    // A pasted publisher URL is saved directly; never replace it with the Google intermediary.
    if (!googleNews(draft.url) && draft.observacao_colaborador?.startsWith('Link do Google Notícias')) delete draft.observacao_colaborador
    await decide(editing, action, draft, editor.elements.confirmacao.checked)
  })
  editor.addEventListener('input', event => {
    if (event.target?.name !== 'url' || !editing || isBusy()) return
    try {
      const url = validatedSourceURL(editor.elements.url.value.trim())
      if (!googleNews(url)) showMessage(editorMessage, 'Endereço original informado manualmente. Clique em Salvar para revisão ou confirme a publicação para gravá-lo.', 'info')
      else showMessage(editorMessage, 'Este ainda é um link intermediário. Abra a matéria e copie o endereço final da barra do navegador.', 'info')
    } catch { showMessage(editorMessage, 'Informe um link HTTPS público válido para a matéria.', 'error') }
  })
  document.querySelector('[data-radar-editor-close]').addEventListener('click', () => { if (!isBusy()) dialog.close() })
  dialog.addEventListener('cancel', event => { if (isBusy()) event.preventDefault() })

  return {
    sync,
    hasPending: () => entries.some(entry => entry.status === 'pendente'),
    render(drafts) {
      container.replaceChildren(); editing = null
      entries = drafts.map(draft => {
        const card = document.createElement('article'); card.className = 'radar-preview-card'
        const heading = document.createElement('h4'); heading.textContent = draft.titulo
        const metadata = document.createElement('p'); metadata.className = 'radar-preview-meta'
        metadata.textContent = `${draft.fonte || 'Fonte não informada'} · Publicação: ${draft.data_publicacao || 'Confira a data'} · ${draft.categoria}`
        const summary = document.createElement('p'); summary.textContent = draft.resumo
        const links = document.createElement('ul'); sourceLink(links, googleNews(draft.url) ? 'Abrir via Google Notícias — copiar endereço final para corrigir' : 'Abrir fonte original', draft.url)
        if (googleNews(draft.url)) metadata.textContent += ' · Link intermediário do Google Notícias'
        const actions = document.createElement('div'); actions.className = 'portal-form-actions'
        const message = document.createElement('p'); message.hidden = true; message.setAttribute('role','status')
        const entry = { draft, heading, message, links, metadata, buttons: [], status: 'pendente' }
        for (const [label, action] of [['Revisar e publicar','editar'],['Salvar para revisão','revisao'],['Descartar','descartar']]) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-small secondary'; button.textContent = label
          button.addEventListener('click', async () => {
            if (!canDecide()) return
            if (action === 'editar') return openEditor(entry)
            if (action === 'descartar') {
              const reason = prompt('Descartar esta sugestão? Ela não entrará no acervo e não será oferecida novamente. Motivo (opcional):', '')
              if (reason === null) return
              await decide(entry, action, entry.draft, false, reason.trim().slice(0,500))
            } else await decide(entry, action)
          })
          entry.buttons.push(button); actions.append(button)
        }
        card.append(heading, metadata, summary, links, actions, message); container.append(card)
        return entry
      })
      sync()
    },
  }
}
