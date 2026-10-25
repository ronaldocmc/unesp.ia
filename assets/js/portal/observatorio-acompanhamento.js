const labels = {
  aguardando_curadoria: 'Aguardando curadoria', revisao: 'Em revisão', publicado: 'Publicado com revisão humana',
  arquivado: 'Arquivado', descartado: 'Descartado', pendente: 'Pendente', agendado: 'Aguardando próxima tentativa',
  processando: 'Processando', resolvido: 'Resolvido', falhou: 'Falhou'
}
const states = { editorial: ['aguardando_curadoria','revisao','publicado','arquivado'], tecnica: ['pendente','agendado','processando','resolvido','falhou'], descartes: ['descartado'] }
const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n }
export function evidenceURL(value) {
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
export const displayDate = value => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Não informada'
export function workerStatus(data) {
  if (Number(data.em_processamento)>0) return 'Há item reservado em processamento'
  if (!data.ultima_execucao) return 'Nenhuma execução registrada pelo monitor'
  const age = Date.parse(data.consultado_em)-Date.parse(data.ultima_execucao)
  return Number.isFinite(age) && age>=0 && age<=5*60000 ? 'Execução recente do processador confirmada' : 'Sem sinal recente do processador — verificar agendamento e função'
}
export async function retryFailedLink(db, row, confirmRetry) {
  if (row.estado_link !== 'falhou' || !/^https:\/\/news\.google\.com\/articles\/[A-Za-z0-9_-]+$/.test(row.chave || '')) throw new Error('Selecione um item com falha na fila técnica.')
  if (!await confirmRetry(`Tentar novamente “${row.titulo || 'este link'}”? Isso libera um novo ciclo de até 5 consultas e preserva as pausas do provedor. Se faltam dados ou há divergência de título/data, confira ou corrija-os antes. Não há garantia de conversão.`)) return null
  const { data, error } = await db.rpc('observatorio_resolucao_reprocessar', { p_chave: row.chave })
  if (error) throw new Error('Não foi possível solicitar. Confira sua permissão e a migration radar_retry_controlado.')
  if (!data?.ok) throw new Error(data?.motivo || 'O item não está mais em falha. Atualize a lista.')
  return data
}

export function mountTracking({ workspace, button, db, openReview, confirmRetry = message => window.confirm(message) }) {
  const panel = el('section', undefined, 'admin-tracking'); panel.hidden = true
  const heading = el('h2', 'Acompanhamento do Radar e curadoria'); heading.tabIndex = -1
  panel.append(heading, el('p', 'A fila técnica identifica endereços; a curadoria decide o que publicar. Resolver um link não aprova uma notícia.'))
  panel.append(el('p', 'Prévias não salvas não contam como publicações aguardando revisão. A fila técnica pode conter links de prévias ou de notícias cadastradas. Descartes ativos têm lista própria. Nenhuma ação em lote ou aprovação automática é feita aqui.', 'admin-tracking-note'))
  const monitor = el('section', undefined, 'admin-worker-monitor'); monitor.setAttribute('aria-label','Atividade do processador de links')
  panel.append(monitor)
  const form = el('form', undefined, 'portal-form admin-tracking-filters')
  const inputs = {}
  const field = (name, label, choices, type = 'text') => {
    const wrap = el('label', label), input = el(choices ? 'select' : 'input')
    input.name = name
    if (choices) for (const [value, text] of choices) { const option = el('option', text); option.value = value; input.append(option) }
    else { input.type = type; if (type === 'text') input.maxLength = 200 }
    wrap.append(input); form.append(wrap); inputs[name] = input; return input
  }
  field('fila','Lista', [['editorial','Curadoria — conteúdos cadastrados'],['tecnica','Técnica — resolução de links'],['descartes','Descartes ativos do Radar']])
  field('busca','Título, veículo ou motivo'); field('inicio','Cadastro desde',null,'date'); field('fim','Cadastro até',null,'date')
  field('veiculo','Veículo'); field('fonte','Fonte'); field('categoria','Categoria'); field('origem','Origem do cadastro')
  field('feed','Feed registrado (nome/código ou nao_informado)')
  field('situacao','Situação', [['','Todas']])
  field('revisao','Revisão humana', [['','Qualquer'],['true','Concluída'],['false','Não concluída']])
  field('estado_link','Estado registrado do link', [['','Qualquer'],['pendente','Pendente'],['processando','Processando'],['resolvido','Resolvido'],['falhou','Falhou'],['nao_informado','Não informado']])
  field('evidencia','Endereço de evidência', [['','Qualquer'],['direta','Link direto'],['google_rss','Fallback Google Notícias'],['ausente','Sem link']])
  const actions = el('div', undefined, 'portal-form-actions')
  const submit = el('button','Aplicar filtros / Atualizar','btn'); submit.type = 'submit'
  const clear = el('button','Limpar filtros','btn secondary'); clear.type = 'button'; actions.append(submit,clear); form.append(actions)
  panel.append(form, el('p', 'Período = data de cadastro (ou descarte), no fuso de Brasília; não a data de publicação. O feed só aparece quando foi registrado: não é inferido pelo veículo. Os totais abaixo respeitam todos os filtros aplicados.', 'admin-tracking-note'))
  const status = el('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite')
  const totals = el('div', undefined, 'admin-tracking-totals'), result = el('div'), providers = el('div')
  const pagination = el('div', undefined, 'portal-form-actions'), prev = el('button','Anterior','btn secondary'), next = el('button','Próxima','btn secondary'), pageLabel = el('span')
  prev.type = next.type = 'button'; pagination.append(prev,pageLabel,next)
  panel.append(status,totals,result,pagination,providers); workspace.prepend(panel); button.hidden = false
  let page = 1, applied = {}, mode = 'editorial', request = 0, previousHidden = null
  const updateStates = () => {
    inputs.situacao.replaceChildren()
    for (const value of ['', ...states[inputs.fila.value]]) { const option = el('option', labels[value] || 'Todas'); option.value = value; inputs.situacao.append(option) }
    const editorial = inputs.fila.value === 'editorial'
    inputs.revisao.disabled = !editorial; if (!editorial) inputs.revisao.value = ''
  }
  updateStates(); inputs.fila.addEventListener('change', updateStates)
  const appendLink = (parent, label, url) => {
    const safe = evidenceURL(url)
    if (!safe) return
    const a = el('a',label); a.href = safe; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.append(a,el('br'))
  }
  const table = (headers, rows) => {
    const wrap = el('div', undefined, 'table-wrap'), table = el('table', undefined, 'admin-table'), head = el('thead'), tr = el('tr'), body = el('tbody')
    headers.forEach(text => { const th = el('th',text); th.scope = 'col'; tr.append(th) }); head.append(tr); table.append(head,body); wrap.append(table)
    rows.forEach(cells => { const tr = el('tr'); cells.forEach(cell => { const td = el('td'); td.append(typeof cell === 'string' ? document.createTextNode(cell) : cell); tr.append(td) }); body.append(tr) })
    return wrap
  }
  async function load() {
    const version = ++request
    submit.disabled = prev.disabled = next.disabled = true
    status.textContent = 'Consultando o banco…'; totals.replaceChildren(); result.replaceChildren(); providers.replaceChildren(); pageLabel.textContent = ''
    monitor.replaceChildren(el('h3','O processador está rodando e tentando converter?'),el('p','Consultando atividade…'))
    try {
      const [listing, activity] = await Promise.all([
        db.rpc('observatorio_acompanhamento', { p_fila: mode, p_filtros: applied, p_pagina: page, p_tamanho: 25 }),
        Promise.resolve().then(() => db.rpc('observatorio_worker_situacao')).catch(() => ({ error: true }))
      ])
      if (version !== request) return
      const { data, error } = listing
      monitor.replaceChildren(el('h3','Atividade do processador — independente dos filtros'))
      if (activity.error || !activity.data || !Object.hasOwn(activity.data,'execucoes_hoje')) {
        monitor.append(el('p','Monitor de execução indisponível. Aplique a migration radar_worker_monitor. Não é possível afirmar se o processador está rodando apenas pelo total da fila.'))
      } else {
        const worker = activity.data
        monitor.append(el('strong',workerStatus(worker)),el('p',`Última execução recebida no banco: ${displayDate(worker.ultima_execucao)} · Último estado: ${worker.ultimo_estado || 'Não registrado'}`))
        const cards = el('div',undefined,'admin-tracking-totals')
        for (const [key,label] of [['execucoes_hoje','Execuções hoje'],['tentativas_hoje','Tentativas com consulta concluídas hoje'],['resolvidos_hoje','Resoluções confirmadas hoje'],['sem_consulta_hoje','Avaliações sem consulta hoje'],['em_processamento','Em processamento agora'],['pendentes','Pendentes restantes']]) cards.append(el('p',`${label}: ${worker[key] ?? 0}`,'admin-tracking-total'))
        monitor.append(cards,el('p',`Última tentativa com consulta concluída: ${displayDate(worker.ultima_tentativa)}`),el('p',`Última resolução confirmada: ${displayDate(worker.ultima_resolucao)}`),el('p',`Próxima elegibilidade da fila: ${displayDate(worker.proxima_elegivel)} (sujeita a pausas e cotas)`))
        if (worker.ultimo_resultado) monitor.append(el('p',`Último resultado: ${worker.ultimo_resultado.situacao} · ${worker.ultimo_resultado.motivo || 'Sem impedimento registrado'} · ${displayDate(worker.ultimo_resultado.data)}`))
        monitor.append(el('p','Execução não significa consulta externa. Uma tentativa só é contada quando o processador finaliza informando que consultou; pode envolver feeds, busca ou Google. Reservar um item ou aguardar uma pausa não conta como conversão. Contadores de hoje começam após ativar o monitor, em Brasília; não há reconstrução retroativa. Falhas antes de chegar ao banco ou antes da finalização não entram nesses contadores.','admin-tracking-note'))
      }
      if (error || !data || !Array.isArray(data.itens)) throw new Error('Consulta indisponível. Confira a migration observatorio_acompanhamento e a permissão de administrador. Nenhum dado foi alterado.')
      totals.append(el('p', `${data.total} registro(s) nos filtros aplicados`, 'admin-tracking-total'))
      if (mode === 'editorial') totals.append(el('p', `${data.aguardando_validacao} aguardando validação editorial`, 'admin-tracking-total'))
      for (const [key, value] of Object.entries(data.contadores || {})) totals.append(el('p', `${labels[key] || key}: ${value}`, 'admin-tracking-total'))
      if (!data.itens.length) result.append(el('p','Nenhum registro corresponde aos filtros.'))
      else result.append(table(['Conteúdo / origem','Situação / revisão','Evidências','Tentativas / motivo / datas','Revisão / reprocessamento'], data.itens.map(row => {
        const title = el('div'); title.append(el('strong',row.titulo || 'Título não informado'),el('p',`Veículo: ${row.veiculo || 'Não informado'}`),el('p',`Fonte: ${row.fonte || 'Não informada'}`),el('p',`Categoria: ${row.categoria || 'Não informada'} · Origem: ${row.origem || 'Não informada'}`),el('p',`Feed: ${row.feed || 'Não informado'} · Publicação: ${row.data_publicacao || 'Não informada'}`))
        const workflow = el('div'); workflow.append(el('strong',labels[row.situacao] || row.situacao),el('p',`Estado do link: ${row.estado_link}`),el('p',`Revisão humana: ${row.revisao_humana == null ? 'Não se aplica' : row.revisao_humana ? 'Concluída' : 'Não concluída'}`),el('p',`Aprovação de curadoria registrada: ${row.aprovado_curadoria == null ? 'Não se aplica' : row.aprovado_curadoria ? 'Sim' : 'Não'}`))
        const links = el('div'); appendLink(links,'URL original identificada',row.url_original); appendLink(links,row.evidencia === 'google_rss' ? 'Abrir fallback Google Notícias' : 'Abrir evidência cadastrada',row.url_evidencia)
        if (row.url_rss && row.url_rss !== row.url_evidencia) appendLink(links,'URL RSS / coletada',row.url_rss)
        links.append(el('p',`Método: ${row.metodo || 'Não informado'}`))
        const info = el('div'); info.append(el('p',`Tentativas: ${row.tentativas}`),el('p',row.motivo || 'Sem motivo registrado'),el('p',`Cadastro: ${displayDate(row.criado_em)}`),el('p',`Atualização: ${displayDate(row.atualizado_em)}`))
        if (row.estado_link === 'falhou') info.append(el('p',Number(row.tentativas)>=5 ? 'Limite atingido — requer reprocessamento autorizado.' : 'Revisão dos dados ou da fonte necessária antes de tentar novamente.'))
        else if (mode === 'tecnica' && row.estado_link === 'pendente' && row.proxima_em) info.append(el('p',`Próxima tentativa elegível: ${displayDate(row.proxima_em)} (sujeita a cotas e pausas)`))
        const action = el('div')
        if (row.conteudo_id != null) {
          const review = el('button','Abrir para revisão','btn-small'); review.type = 'button'
          review.addEventListener('click', async () => { review.disabled = true; try { await openReview(row.conteudo_id) } catch { status.textContent = 'Não foi possível abrir o conteúdo. Atualize a lista e tente novamente.' } finally { review.disabled = false } }); action.append(review)
        } else action.append(el('span', mode === 'descartes' ? 'Descarte registrado; sem edição nesta lista.' : 'Sem conteúdo cadastrado associado. Não conta como pendência editorial.'))
        if (mode === 'tecnica' && row.estado_link === 'falhou') {
          const retry = el('button','Tentar novamente','btn-small'); retry.type = 'button'
          retry.addEventListener('click', async () => {
            if (retry.disabled) return
            retry.disabled = true
            try {
              const queued = await retryFailedLink(db,row,confirmRetry)
              if (!queued) return
              await load()
              status.textContent = `Reprocessamento solicitado. Próxima elegibilidade: ${displayDate(queued.proxima_em)} (sujeita às pausas e cotas). O link ainda não foi convertido.`
            } catch (error) { status.textContent = error.message }
            finally { retry.disabled = false }
          })
          action.append(retry)
        }
        return [title,workflow,links,info,action]
      })))
      if (mode === 'tecnica') {
        providers.append(el('h3','Intervalos e pausas compartilhadas por origem'),el('p','Estado geral dos provedores, independente dos filtros da lista. Uma pausa futura pode impedir novas requisições; o término não garante resolução.'))
        providers.append(table(['Origem','Dia / requisições registradas','Próximo acesso','Pausa até'], (data.origens || []).map(row => [row.origem,`${row.dia} / ${row.quantidade}`,displayDate(row.proxima_em),displayDate(row.pausado_ate)])))
      }
      status.textContent = `Atualizado em ${displayDate(data.consultado_em)} (Brasília). Atualização manual, sem disparar coleta ou reprocessamento.`
      pageLabel.textContent = `Página ${page} de ${Math.max(1,Math.ceil(data.total/25))}`
      prev.disabled = page <= 1; next.disabled = page * 25 >= data.total
    } catch (error) { if (version === request) status.textContent = error.message }
    finally { if (version === request) submit.disabled = false }
  }
  form.addEventListener('submit', event => { event.preventDefault(); mode = inputs.fila.value; applied = Object.fromEntries(Object.entries(inputs).filter(([key]) => key !== 'fila').map(([key,input]) => [key,input.value])); page = 1; void load() })
  clear.addEventListener('click', () => { form.reset(); updateStates(); mode = inputs.fila.value; applied = {}; page = 1; void load() })
  prev.addEventListener('click', () => { if (page > 1) { page--; void load() } }); next.addEventListener('click', () => { page++; void load() })
  const hide = () => {
    if (!previousHidden) return
    ++request; panel.hidden = true; button.classList.remove('active')
    previousHidden.forEach(([child, hidden]) => { child.hidden = hidden }); previousHidden = null
  }
  button.addEventListener('click', () => {
    if (!previousHidden) { previousHidden = [...workspace.children].filter(child => child !== panel).map(child => [child,child.hidden]); previousHidden.forEach(([child]) => { child.hidden = true }) }
    panel.hidden = false; button.classList.add('active'); document.querySelectorAll('[data-admin-tab]').forEach(tab => tab.classList.remove('active')); heading.focus(); void load()
  })
  return { hide }
}
