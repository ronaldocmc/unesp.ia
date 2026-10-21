import { supabase, showMessage } from './supabase.js'
import { buildRadarLinkDiagnostic, readRadarFunctionError } from './radar-diagnostico.js?v=20261020-resolucao-inteligente'

export function initRadarCuradoria({ canDecide, setBusy, isBusy, sourceLink, schedule = setTimeout, cancelSchedule = clearTimeout }) {
  const container = document.querySelector('[data-radar-preview]')
  const counts = document.querySelector('[data-radar-decisions]')
  const dialog = document.querySelector('[data-radar-editor]')
  const editor = document.querySelector('[data-radar-editor-form]')
  const editorMessage = document.querySelector('[data-radar-editor-message]')
  const diagnosticOutput = document.querySelector('[data-radar-diagnostic-output]')
  let entries = []
  let editing = null
  let pollTimer = null
  function stopPolling() { if (pollTimer !== null) cancelSchedule(pollTimer); pollTimer = null }
  function pollQueue(entry, remaining = 60) {
    stopPolling()
    if (!remaining || editing !== entry || !dialog.open || entry.status !== 'pendente'
      || !['pendente','processando'].includes(entry.fila) || !googleNews(entry.draft.url)) return
    pollTimer = schedule(async () => {
      pollTimer = null
      if (editing !== entry || !dialog.open || entry.status !== 'pendente' || editor.elements.url.value !== entry.draft.url) return
      if (!isBusy()) await resolveEntryLink(entry, entry.draft, { somenteCache: true })
      pollQueue(entry, remaining - 1)
    }, 30000)
    pollTimer?.unref?.()
  }
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
    sourceLink(entry.links, googleNews(draft.url) ? 'Abrir matéria via Google Notícias' : 'Abrir fonte original', draft.url)
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

  async function resolveEntryLink(entry, draft = entry.draft, { somenteCache = false } = {}) {
    if (!googleNews(draft.url)) return
    const requestedURL = draft.url
    if (!somenteCache) {
      entry.diagnostic = null
      showMessage(entry.message, 'Identificando endereço original desta matéria...', 'info')
      if (editing === entry && dialog.open) showMessage(editorMessage, 'Identificando endereço original desta matéria...', 'info')
    }
    try {
      const { data, error, response } = await supabase.functions.invoke('observatorio-radar', {
        // previa also prevents writes if an older function does not know this action.
        body: { acao: 'resolver_link_google', url: draft.url, previa: true, limite_total: 1, ...(somenteCache ? { somente_cache: true } : {}) },
      })
      if (somenteCache && (editing !== entry || !dialog.open || editor.elements.url.value !== requestedURL)) return
      const details = error ? await readRadarFunctionError(error) : { data, httpStatus: response?.status }
      entry.diagnostic = buildRadarLinkDiagnostic({ inputURL: draft.url, data: details.data, error, httpStatus: details.httpStatus })
      if (error) throw new Error(entry.diagnostic.http_status
        ? `Falha HTTP ${entry.diagnostic.http_status} na conversão. Clique em Copiar diagnóstico.`
        : 'Não foi possível acessar a conversão. Clique em Copiar diagnóstico.')
      if (data?.acao !== 'resolver_link_google') throw new Error('A função não reconheceu a conversão individual. Clique em Copiar diagnóstico.')
      entry.fila = data.fila
      if (entry.retryButton) entry.retryButton.hidden = data.fila !== 'falhou'
      if (somenteCache && !data.resolvido) return
      if (!data.resolvido) {
        const retomar = typeof data.retomar_em === 'string' && Number.isFinite(Date.parse(data.retomar_em))
          ? ` Nova tentativa após ${new Date(data.retomar_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília).` : ''
        throw new Error(`Conversão individual: ${data.diagnostico || 'endereço original não identificado'}.${retomar}`)
      }
      const url = new URL(data.url)
      if (url.protocol !== 'https:' || googleNews(url.href) || url.username || url.password) throw new Error('A função não retornou um endereço original válido.')
      draft.url = url.href
      entry.draft.url = url.href
      for (const value of [draft, entry.draft]) if (value.observacao_colaborador?.startsWith('Link do Google Notícias')) delete value.observacao_colaborador
      refreshEntryLink(entry)
      if (editing === entry && dialog.open) {
        editor.elements.url.value = url.href
        showMessage(editorMessage, data.cache ? 'Endereço original recuperado do cache, sem acessar o Google. Confira os demais dados antes de publicar.'
          : 'Endereço original identificado. Confira os demais dados antes de publicar.', 'success')
      }
      showMessage(entry.message, 'Endereço original identificado.', 'success')
      stopPolling()
    } catch (error) {
      if (somenteCache) return // Mantém o aviso anterior; a consulta de cache não acessa o Google.
      if (!entry.diagnostic) entry.diagnostic = buildRadarLinkDiagnostic({ inputURL: draft.url, error })
      const queued = ['pendente','processando'].includes(entry.fila)
        ? ' O link está na fila automática. Este campo será atualizado quando o endereço ficar disponível; se preferir, você pode informá-lo manualmente.' : ''
      const text = `Link do Google Notícias — endereço original não identificado. ${error.message}${queued}`
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
    stopPolling(); editing = entry
    for (const name of ['titulo','resumo','data_publicacao','fonte','url','categoria']) editor.elements[name].value = entry.draft[name] || ''
    editor.elements.confirmacao.checked = false
    editor.elements.confirmacao.required = false
    editorMessage.hidden = true
    diagnosticOutput.hidden = true; diagnosticOutput.value = ''
    if (googleNews(entry.draft.url)) showMessage(editorMessage, entry.draft.observacao_colaborador?.startsWith('Link do Google Notícias')
      ? entry.draft.observacao_colaborador : 'Link do Google Notícias — endereço original não identificado. Abra a notícia e confira o veículo antes de publicar.', 'info')
    dialog.showModal()
    if (googleNews(entry.draft.url)) {
      setBusy(true); sync()
      try { await resolveEntryLink(entry) } finally { setBusy(false); sync(); pollQueue(entry) }
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
  document.querySelector('[data-radar-copy-diagnostic]').addEventListener('click', async () => {
    if (!editing || isBusy()) return
    const diagnostic = editing.diagnostic || buildRadarLinkDiagnostic({ inputURL: editing.draft.url })
    if (!editing.diagnostic) diagnostic.estado = 'conversao_individual_nao_executada'
    diagnosticOutput.value = JSON.stringify(diagnostic, null, 2)
    diagnosticOutput.hidden = false
    try {
      await navigator.clipboard.writeText(diagnosticOutput.value)
      showMessage(editorMessage, 'Diagnóstico copiado. Cole o texto na conversa para analisarmos.', 'success')
    } catch {
      diagnosticOutput.focus(); diagnosticOutput.select()
      showMessage(editorMessage, 'Selecione o texto do diagnóstico abaixo e pressione Ctrl+C para copiar.', 'info')
    }
  })
  dialog.addEventListener('cancel', event => { if (isBusy()) event.preventDefault() })
  dialog.addEventListener('close', stopPolling)

  return {
    sync,
    hasPending: () => entries.some(entry => entry.status === 'pendente'),
    render(drafts) {
      stopPolling(); container.replaceChildren(); editing = null
      entries = drafts.map(draft => {
        if (draft.url_original) {
          try { const original = validatedSourceURL(draft.url_original); if (!googleNews(original)) draft = { ...draft, url: original } } catch { /* Preserva o fallback. */ }
        }
        const card = document.createElement('article'); card.className = 'radar-preview-card'
        const heading = document.createElement('h4'); heading.textContent = draft.titulo
        const metadata = document.createElement('p'); metadata.className = 'radar-preview-meta'
        metadata.textContent = `${draft.fonte || 'Fonte não informada'} · Publicação: ${draft.data_publicacao || 'Confira a data'} · ${draft.categoria}`
        const summary = document.createElement('p'); summary.textContent = draft.resumo
        const links = document.createElement('ul'); sourceLink(links, googleNews(draft.url) ? 'Abrir matéria via Google Notícias' : 'Abrir fonte original', draft.url)
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
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn-small secondary'
        retry.textContent = 'Reprocessar link'; retry.hidden = true; entry.retryButton = retry
        retry.addEventListener('click', async () => {
          if (!canDecide() || isBusy() || entry.status !== 'pendente' || entry.fila !== 'falhou') return
          const id = new URL(entry.draft.url).pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]+)$/)?.[1]
          if (!id) return
          setBusy(true); sync()
          try {
            const { data, error } = await supabase.rpc('observatorio_resolucao_reprocessar', { p_chave: `https://news.google.com/articles/${id}` })
            if (error || !data?.ok) throw new Error('Não foi possível reabrir este link. Confira se a atualização do banco foi aplicada.')
            entry.fila = 'pendente'; retry.hidden = true
            showMessage(entry.message, 'Link recolocado na fila. Os intervalos e bloqueios dos provedores continuam sendo respeitados.', 'info')
            pollQueue(entry)
          } catch (error) { showMessage(entry.message, error.message, 'error') }
          finally { setBusy(false); sync() }
        })
        entry.buttons.push(retry); actions.append(retry)
        card.append(heading, metadata, summary, links, actions, message); container.append(card)
        return entry
      })
      sync()
    },
  }
}
