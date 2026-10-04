import { requireRole, supabase, showMessage } from './supabase.js'

const initiativeDefinition = (title, eixo) => ({
  title,
  description: `Cadastre projetos, produtos, formações, ferramentas e outras iniciativas de ${title}.`,
  sourceTable: 'ecossistema_iniciativas', filter: { eixo }, order: 'ordem', pk: ['id'],
  columns: ['id','tipo','nome','descricao','url','ordem','status','revisao_humana'], fields: [
    ['eixo','Eixo','fixed',true,eixo], ['tipo','Tipo','text',true], ['nome','Nome','text',true],
    ['descricao','Descrição','textarea',true], ['url','Link interno ou URL externa','text',false], ['externo','Abrir em nova aba','checkbox',false,false],
    ['ordem','Ordem','number',true], ['destaque','Destaque','checkbox',false,false],
    ['status','Situação editorial','select-static',true,['rascunho','revisao','publicado','arquivado']],
    ['revisao_humana','Revisão humana concluída','checkbox',false,false]
  ]
})

const definitions = {
  ecossistema_eixos: { title: 'Configuração dos eixos', description: 'Edite identidade, descrição, destaques e chamada pública dos quatro eixos.', pk: ['id'], order: 'ordem', columns: ['id','ordem','nome','rotulo','status','revisao_humana'], fields: [
    ['id','Identificador técnico','text',true], ['ordem','Ordem','number',true], ['nome','Nome público','text',true],
    ['rotulo','Subtítulo','text',true], ['descricao','Descrição','textarea',true],
    ['destaques','Destaques, separados por vírgulas','textarea',false], ['acao_rotulo','Texto do botão','text',true],
    ['acao_url','Destino do botão','text',true], ['acao_externa','Abrir em nova aba','checkbox',false,false],
    ['status','Situação editorial','select-static',true,['rascunho','revisao','publicado','arquivado']],
    ['revisao_humana','Revisão humana concluída','checkbox',false,false]
  ]},
  aprender_ia: initiativeDefinition('Aprender.IA','aprender'),
  experimentar_ia: initiativeDefinition('Experimentar.IA','experimentar'),
  pesquisar_ia: initiativeDefinition('Pesquisar.IA','pesquisa'),
  inovar_ia: initiativeDefinition('Inovar.IA','inovacao'),
  modulos: { title: 'Módulos', description: 'Catálogo acadêmico e carga horária.', pk: ['id'], fields: [
    ['codigo','Código','text',true], ['descricao','Descrição','text',true], ['carga_horaria','Carga horária','number',true], ['ativo','Ativo','checkbox',false]
  ]},
  turmas: { title: 'Turmas', description: 'Ofertas de módulos por período.', pk: ['id'], fields: [
    ['descricao','Descrição','text',true], ['modulo_id','Módulo','select',true,'modulos'], ['data_inicio','Data de início','date',true], ['data_fim','Data de término','date',false], ['ativa','Ativa','checkbox',false]
  ]},
  participantes: { title: 'Participantes', description: 'Dados pessoais e conta de acesso por e-mail.', pk: ['id'], import: true, fields: [
    ['nome','Nome','text',true], ['cpf','CPF (11 dígitos)','text',true], ['telefone','Telefone','text',false], ['email','E-mail','email',true], ['genero','Gênero','text',false], ['escolaridade','Escolaridade','text',false], ['endereco','Endereço','textarea',false], ['ativo','Ativo','checkbox',false]
  ]},
  matriculas: { title: 'Matrículas', description: 'Vínculo entre participante e turma.', pk: ['turma_id','participante_id'], fields: [
    ['turma_id','Turma','select',true,'turmas'], ['participante_id','Participante','select',true,'participantes'], ['status','Status','select-static',true,['ativa','concluida','cancelada','trancada']]
  ]},
  encontros: { title: 'Encontros', description: 'Aulas semanais e conteúdo ministrado.', pk: ['id'], fields: [
    ['turma_id','Turma','select',true,'turmas'], ['data','Data','date',true], ['carga_horaria','Carga horária','number',true], ['conteudo_ministrado','Conteúdo ministrado','textarea',true]
  ]},
  frequencias: { title: 'Frequências', description: 'Presença por encontro; somente matriculados são aceitos.', pk: ['encontro_id','participante_id'], fields: [
    ['encontro_id','Encontro','select',true,'encontros'], ['participante_id','Participante','select',true,'participantes'], ['presente','Presente','checkbox',false], ['observacao','Observação','textarea',false]
  ]},
  conteudos_modulo: { title: 'Conteúdos protegidos', description: 'HTML ou caminho no bucket privado, liberado por matrícula.', pk: ['id'], fields: [
    ['modulo_id','Módulo','select',true,'modulos'], ['titulo','Título','text',true], ['ordem','Ordem','number',true], ['html','HTML do conteúdo','textarea',false], ['storage_path','Caminho no Storage','text',false], ['publicado','Publicado','checkbox',false]
  ]},
  observatorio_categorias: { title: 'Categorias do Observatório', description: 'Lista controlada de categorias usadas para classificar publicações do Observatório.', order: 'ordem', pk: ['id'], columns: ['id','nome','descricao','ordem','ativo'], fields: [
    ['nome','Nome da categoria','text',true], ['descricao','Descrição','textarea',false], ['ordem','Ordem','number',true], ['ativo','Ativo','checkbox',false,true]
  ]},
  observatorio_veiculos: { title: 'Veículos de comunicação', description: 'Lista controlada de veículos, fontes e canais de comunicação usados nas publicações.', order: 'nome', pk: ['id'], columns: ['id','nome','tipo','url','ativo'], fields: [
    ['nome','Nome do veículo','text',true],
    ['tipo','Tipo de veículo','select-static',true,['Portal','Jornal','Revista','TV','Rádio','Podcast','Agência','Instituição','Blog','Outro']],
    ['url','Site oficial','url',false], ['ativo','Ativo','checkbox',false,true]
  ]},
  observatorio_conteudos: { title: 'Publicações do Observatório', description: 'Cadastre, revise e publique notícias, pesquisas, análises e matérias sobre os projetos. Os registros são salvos diretamente no banco do Observatório.', order: 'updated_at', descending: true, pk: ['id'], columns: ['id','colecao','tipo','titulo','data_publicacao','origem','submetido_email','status','revisao_humana','destaque'], fields: [
    ['colecao','Coleção','select-static',true,['Observatório','unesp.IA na mídia']],
    ['tipo','Tipo de conteúdo ou mídia','select-static',true,['Notícia institucional','Notícia monitorada','Pesquisa','Tecnologia','Análise','Artigo científico','Tese ou dissertação','TV','Jornal','Revista','Rádio','Podcast','Portal','Vídeo','Política ou regulação','Evento ou oportunidade','Indicador']],
    ['categoria','Categoria','select-text',true,'observatorio_categorias'], ['titulo','Título','text',true], ['resumo','Resumo','textarea',true],
    ['projeto_relacionado','Projeto relacionado','text',false], ['veiculo','Veículo de comunicação','select-text',false,'observatorio_veiculos'],
    ['data_publicacao','Data de publicação','date',true], ['url','Link da matéria ou fonte','url',true],
    ['video_url','Link do vídeo','url',false], ['imagem_url','Link da imagem de capa','url',false],
    ['participantes','Entrevistados ou participantes','textarea',false], ['cidade','Cidade','text',false],
    ['abrangencia','Abrangência','select-static',false,['Local','Regional','Estadual','Nacional','Internacional']],
    ['palavras_chave','Palavras-chave, separadas por vírgulas','text',false], ['fonte','Fonte ou autoria','text',true],
    ['origem','Origem do cadastro','select-static',true,['Cadastro manual','Agente de IA','Importação','Usuário identificado']],
    ['observacao_colaborador','Observação do usuário ou curadoria','textarea',false],
    ['status','Situação editorial','select-static',true,['rascunho','revisao','publicado','arquivado']],
    ['destaque','Destacar no Observatório','checkbox',false,false], ['revisao_humana','Revisão humana concluída','checkbox',false,false]
  ]},
  candidatos_observatorio: { title: 'Sugestões do agente', description: 'Itens coletados automaticamente. Revise a fonte e use uma sugestão para iniciar um cadastro; nenhuma sugestão é publicada automaticamente.', virtual: true, pk: ['id'], fields: [] },
}

const requestedSection = new URLSearchParams(location.search).get('secao')
const adminScope = document.body.dataset.adminScope || 'portal'
const observatorioSections = ['observatorio_conteudos', 'observatorio_categorias', 'observatorio_veiculos']
const allowedSections = adminScope === 'observatorio' ? observatorioSections : Object.keys(definitions).filter(key => key !== 'candidatos_observatorio')
const initialTable = allowedSections.includes(requestedSection) ? requestedSection : (adminScope === 'observatorio' ? 'observatorio_conteudos' : 'ecossistema_eixos')
const state = { table: initialTable, rows: [], editing: null, lookups: {}, saving: false, importing: false }
const $ = (selector) => document.querySelector(selector)
const message = $('[data-admin-message]')
const dialog = $('[data-record-dialog]')
const form = $('[data-record-form]')

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const keyOf = (row, def = definitions[state.table]) => def.pk.map(k => row[k]).join('|')
const sourceTableOf = (def = definitions[state.table]) => def.sourceTable || state.table

document.querySelector('[data-logout]').addEventListener('click', async () => {
  await supabase.auth.signOut(); location.href = 'login.html'
})

document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', async () => {
  if (!allowedSections.includes(button.dataset.adminTab)) return
  document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b === button))
  state.table = button.dataset.adminTab
  await renderTable()
}))

$('[data-new-record]').addEventListener('click', () => openDialog())
$('[data-dialog-close]').addEventListener('click', () => dialog.close())
dialog.addEventListener('cancel', event => { if (state.saving) event.preventDefault() })
$('[data-import-button]').addEventListener('click', () => $('[data-import-file]').click())
$('[data-import-file]').addEventListener('change', importSpreadsheet)
form.addEventListener('submit', saveRecord)
$('[data-link-form]').addEventListener('submit', importLink)
$('[data-manual-link]').addEventListener('click', () => openDialog(manualDraft(), { asNew: true }))

function manualDraft() {
  return { colecao: 'Observatório', tipo: 'Notícia monitorada', categoria: 'Atualidades',
    url: $('[data-link-form]').elements.source_url.value.trim(), origem: 'Cadastro manual',
    status: 'rascunho', destaque: false, revisao_humana: false }
}

function normalizeLink(value) {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Informe um link HTTP ou HTTPS válido, sem credenciais.')
  url.hash = ''
  return url.href
}

async function existingPublication(url, exceptId) {
  let query = supabase.from('observatorio_conteudos').select('*').eq('url', url).limit(1)
  if (exceptId != null) query = query.neq('id', exceptId)
  const { data, error } = await query
  if (error) throw error
  return data?.[0]
}

async function importLink(event) {
  event.preventDefault()
  if (state.importing) return
  state.importing = true
  const linkMessage = $('[data-link-message]')
  const controls = document.querySelectorAll('[data-admin-tab], [data-new-record], [data-admin-body] button, [data-link-form] button')
  controls.forEach(button => { button.disabled = true })
  showMessage(linkMessage, 'Buscando os dados públicos da matéria...', 'info')
  try {
    const url = normalizeLink($('[data-link-form]').elements.source_url.value.trim())
    let existing = await existingPublication(url)
    if (existing) {
      await openDialog(existing)
      showMessage($('[data-dialog-message]'), 'Este link já está cadastrado. Você está editando a publicação existente.', 'info')
      showMessage(linkMessage, 'Cadastro existente aberto para edição.', 'info')
      return
    }
    const { data, error } = await supabase.functions.invoke('observatorio-link', { body: { url } })
    if (error || data?.error) {
      let detail = data?.error
      if (!detail && error?.context?.json) {
        try { detail = (await error.context.json()).error } catch { /* Network errors have no JSON body. */ }
      }
      throw new Error(detail || 'A importação está indisponível. Tente novamente ou use “Preencher manualmente”.')
    }
    if (!data?.draft?.url) throw new Error('A fonte não retornou dados. Use “Preencher manualmente”.')
    existing = await existingPublication(data.draft.url)
    await openDialog(existing || data.draft, { asNew: !existing })
    showMessage($('[data-dialog-message]'), existing ? 'O endereço final já está cadastrado. Edite a publicação existente.' : (data.warnings || []).join(' '), 'info')
    showMessage(linkMessage, 'Dados carregados para revisão. Nada foi salvo ou publicado automaticamente.', 'success')
  } catch (error) { showMessage(linkMessage, error.message, 'error') }
  finally { state.importing = false; controls.forEach(button => { button.disabled = false }) }
}

async function loadLookup(table) {
  if (state.lookups[table]) return state.lookups[table]
  const select = table === 'modulos' ? 'id,codigo,descricao'
    : table === 'turmas' ? 'id,descricao'
    : table === 'participantes' ? 'id,nome,email'
    : table === 'observatorio_categorias' ? 'id,nome,descricao,ativo,ordem'
    : table === 'observatorio_veiculos' ? 'id,nome,tipo,url,ativo'
    : 'id,data,turma_id'
  let query = supabase.from(table).select(select)
  if (table === 'observatorio_categorias') query = query.eq('ativo', true).order('ordem')
  else if (table === 'observatorio_veiculos') query = query.eq('ativo', true).order('nome')
  else query = query.order('id')
  const { data, error } = await query
  if (error) throw error
  state.lookups[table] = data
  return data
}

function lookupLabel(table, row) {
  if (table === 'modulos') return `${row.codigo} - ${row.descricao}`
  if (table === 'participantes') return `${row.nome} - ${row.email}`
  if (table === 'encontros') return `#${row.id} - ${row.data} (turma ${row.turma_id})`
  if (table === 'observatorio_categorias') return row.nome
  if (table === 'observatorio_veiculos') return row.tipo ? `${row.nome} (${row.tipo})` : row.nome
  return `#${row.id} - ${row.descricao}`
}

async function renderTable() {
  const def = definitions[state.table]
  if (!allowedSections.includes(state.table)) {
    state.table = initialTable
    return renderTable()
  }
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.classList.toggle('active', button.dataset.adminTab === state.table))
  $('[data-link-panel]').hidden = state.table !== 'observatorio_conteudos'
  $('[data-admin-title]').textContent = def.title
  $('[data-admin-description]').textContent = def.description
  $('[data-import-button]').hidden = !def.import
  $('[data-new-record]').hidden = Boolean(def.virtual)
  if (def.virtual) return renderCandidateQueue()
  showMessage(message, 'Carregando registros...', 'info')
  let query = supabase.from(sourceTableOf(def)).select('*').limit(1000)
  for (const [column, value] of Object.entries(def.filter || {})) query = query.eq(column, value)
  if (def.order) query = query.order(def.order, { ascending: !def.descending })
  const { data, error } = await query
  if (error) return showMessage(message, error.message, 'error')
  state.rows = data ?? []
  const columns = def.columns || [...new Set([...def.pk, ...def.fields.map(f => f[0])])]
  $('[data-admin-head]').innerHTML = `<tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}<th>Ações</th></tr>`
  $('[data-admin-body]').innerHTML = state.rows.map(row => `<tr>${columns.map(c => `<td>${escapeHtml(formatValue(row[c]))}</td>`).join('')}<td><div class="admin-table-actions"><button data-edit="${escapeHtml(keyOf(row))}">Editar</button><button data-delete="${escapeHtml(keyOf(row))}">Excluir</button></div></td></tr>`).join('') || `<tr><td colspan="${columns.length + 1}">Nenhum registro.</td></tr>`
  $('[data-admin-body]').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openDialog(findRow(b.dataset.edit))))
  $('[data-admin-body]').querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteRecord(findRow(b.dataset.delete))))
  showMessage(message, `${state.rows.length} registro(s) carregado(s).`, 'success')
}

const formatValue = value => typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : (value ?? '')
const findRow = key => state.rows.find(row => keyOf(row) === key)

async function openDialog(row = null, options = {}) {
  if (!row && state.table === 'observatorio_conteudos') { row = { ...manualDraft(), url: '' }; options = { ...options, asNew: true } }
  state.editing = options.asNew ? null : row
  const def = definitions[state.table]
  $('[data-dialog-title]').textContent = `${state.editing ? 'Editar' : 'Cadastrar'} ${def.title.toLowerCase()}`
  $('[data-editorial-help]').hidden = state.table !== 'observatorio_conteudos'
  const container = $('[data-dialog-fields]')
  container.innerHTML = ''
  for (const [name, label, type, required, source] of def.fields) {
    const value = row?.[name]
    const disabled = Boolean(row && def.pk.includes(name))
    let control
    if (type === 'fixed') control = `<span class="portal-fixed-value">${escapeHtml(source)}</span><input type="hidden" name="${name}" value="${escapeHtml(source)}">`
    else if (type === 'textarea') control = `<textarea name="${name}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea>`
    else if (type === 'checkbox') control = `<input type="checkbox" name="${name}" ${(row ? value !== false : source !== false) ? 'checked' : ''}>`
    else if (type === 'select-static') control = `<select name="${name}" ${required ? 'required' : ''}>${required ? '' : '<option value="">Selecione</option>'}${source.map(v => `<option value="${v}" ${value === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`
    else if (type === 'select') {
      const options = await loadLookup(source)
      control = `<select name="${name}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}><option value="">Selecione</option>${options.map(o => `<option value="${o.id}" ${Number(value) === Number(o.id) ? 'selected' : ''}>${escapeHtml(lookupLabel(source, o))}</option>`).join('')}</select>${disabled ? `<input type="hidden" name="${name}" value="${value}">` : ''}`
    } else if (type === 'select-text') {
      const options = await loadLookup(source)
      control = `<select name="${name}" ${required ? 'required' : ''}><option value="">Selecione</option>${options.map(o => `<option value="${escapeHtml(o.nome)}" ${value === o.nome ? 'selected' : ''}>${escapeHtml(lookupLabel(source, o))}</option>`).join('')}</select>`
    } else control = `<input type="${type}" name="${name}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}>${disabled ? `<input type="hidden" name="${name}" value="${escapeHtml(value)}">` : ''}`
    container.insertAdjacentHTML('beforeend', `<label>${label}${control}</label>`)
  }
  $('[data-dialog-message]').hidden = true
  dialog.showModal()
}

async function renderCandidateQueue() {
  showMessage(message, 'Carregando sugestões coletadas pelo agente...', 'info')
  try {
    const response = await fetch('assets/data/observatorio-candidatos.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('Não foi possível carregar a fila de sugestões.')
    const payload = await response.json()
    state.rows = payload.itens || []
    const columns = ['fonte','tipo','titulo','dataPublicacao','revisao']
    $('[data-admin-head]').innerHTML = `<tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}<th>Ações</th></tr>`
    $('[data-admin-body]').innerHTML = state.rows.map((row, index) => `<tr>${columns.map(c => `<td>${escapeHtml(formatValue(row[c]))}</td>`).join('')}<td><div class="admin-table-actions"><button data-use-candidate="${index}">Usar no cadastro</button><a class="btn-small secondary" href="${escapeHtml(row.href)}" target="_blank" rel="noopener noreferrer">Ver fonte</a></div></td></tr>`).join('') || '<tr><td colspan="6">Nenhuma sugestão pendente. A fila será preenchida na próxima execução do agente.</td></tr>'
    $('[data-admin-body]').querySelectorAll('[data-use-candidate]').forEach(button => button.addEventListener('click', () => useCandidate(state.rows[Number(button.dataset.useCandidate)])))
    const errorCount = (payload.erros || []).length
    showMessage(message, `${state.rows.length} sugestão(ões) disponível(is).${errorCount ? ` ${errorCount} fonte(s) apresentou(aram) falha na última coleta.` : ''}`, errorCount ? 'info' : 'success')
  } catch (error) { showMessage(message, error.message, 'error') }
}

function useCandidate(candidate) {
  const isoDate = /^\d{4}-\d{2}-\d{2}/.test(candidate.dataPublicacao || '') ? candidate.dataPublicacao.slice(0, 10) : ''
  const draft = {
    colecao: 'Observatório', tipo: candidate.tipo === 'Artigos científicos' ? 'Artigo científico' : 'Notícia monitorada',
    categoria: candidate.tipo || 'Atualidades', titulo: candidate.titulo, resumo: candidate.resumoOriginal,
    data_publicacao: isoDate, url: candidate.href, fonte: candidate.fonte, origem: 'Agente de IA',
    status: 'revisao', destaque: false, revisao_humana: false
  }
  state.table = 'observatorio_conteudos'
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.classList.toggle('active', button.dataset.adminTab === state.table))
  openDialog(draft, { asNew: true })
}

function formPayload(def) {
  const fd = new FormData(form); const payload = {}
  for (const [name,,type,,source] of def.fields) {
    if (type === 'checkbox') payload[name] = form.elements[name].checked
    else if (type === 'fixed') payload[name] = source
    else if (['number','select'].includes(type) && fd.get(name) !== '') payload[name] = Number(fd.get(name))
    else payload[name] = String(fd.get(name) ?? '').trim() || null
  }
  if (payload.cpf) payload.cpf = String(payload.cpf).replace(/\D/g, '')
  return payload
}

async function saveRecord(event) {
  event.preventDefault()
  if (state.saving) return
  state.saving = true
  const formButtons = form.querySelectorAll('button')
  formButtons.forEach(button => { button.disabled = true })
  const def = definitions[state.table]
  const payload = formPayload(def)
  const dialogMessage = $('[data-dialog-message]')
  showMessage(dialogMessage, 'Salvando...', 'info')
  try {
    if (state.table === 'observatorio_conteudos') {
      if (payload.status === 'publicado' && !payload.revisao_humana) throw new Error('Confirme “Revisão humana concluída” antes de publicar.')
      payload.url = normalizeLink(payload.url)
      for (const field of ['video_url', 'imagem_url']) if (payload[field]) payload[field] = normalizeLink(payload[field])
      if (await existingPublication(payload.url, state.editing?.id)) throw new Error('Este link já possui uma publicação. Cancele e edite o registro existente.')
    }
    if (state.table === 'participantes' && !state.editing) {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: {
        action: 'create_participant', participant: payload,
        redirectTo: new URL('redefinir-senha.html', location.href).href,
      } })
      if (error || data?.error) throw new Error(data?.error || error.message)
    } else {
      if (state.table === 'participantes' && state.editing.email !== payload.email) {
        const { data, error } = await supabase.functions.invoke('admin-users', { body: {
          action: 'update_participant_email', participantId: state.editing.id, email: payload.email,
        } })
        if (error || data?.error) throw new Error(data?.error || error.message)
        delete payload.email
      }
      let query = state.editing ? supabase.from(sourceTableOf(def)).update(payload) : supabase.from(sourceTableOf(def)).insert(payload)
      if (state.editing) for (const pk of def.pk) query = query.eq(pk, state.editing[pk])
      const { error } = await query
      if (error) throw error
    }
    dialog.close(); state.lookups = {}; await renderTable()
    if (state.table === 'observatorio_conteudos') showMessage(message, payload.status === 'publicado'
      ? 'Publicação salva no banco e disponível no Observatório. Atualize a página pública para vê-la.'
      : 'Cadastro salvo no banco. Este conteúdo ainda não está publicado no Observatório.', 'success')
  } catch (error) { showMessage(dialogMessage, error.message, 'error') }
  finally { state.saving = false; formButtons.forEach(button => { button.disabled = false }) }
}

async function deleteRecord(row) {
  if (!confirm('Confirma a exclusão deste registro? Relações dependentes poderão ser removidas.')) return
  try {
    if (state.table === 'participantes') {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'delete_participant', participantId: row.id } })
      if (error || data?.error) throw new Error(data?.error || error.message)
    } else {
      let query = supabase.from(sourceTableOf()).delete()
      for (const pk of definitions[state.table].pk) query = query.eq(pk, row[pk])
      const { error } = await query
      if (error) throw error
    }
    state.lookups = {}; await renderTable()
  } catch (error) { showMessage(message, error.message, 'error') }
}

async function importSpreadsheet(event) {
  const file = event.target.files[0]; if (!file) return
  showMessage(message, 'Lendo planilha...', 'info')
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
    let success = 0; const errors = []
    for (let index = 0; index < rows.length; index++) {
      const normalized = Object.fromEntries(Object.entries(rows[index]).map(([k,v]) => [k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,'_'), v]))
      const participant = {
        nome: normalized.nome, cpf: String(normalized.cpf).replace(/\D/g,''), telefone: normalized.telefone || null,
        email: String(normalized.email).trim().toLowerCase(), genero: normalized.genero || null,
        escolaridade: normalized.escolaridade || null, endereco: normalized.endereco || null, ativo: true,
      }
      const { data, error } = await supabase.functions.invoke('admin-users', { body: {
        action: 'create_participant', participant,
        redirectTo: new URL('redefinir-senha.html', location.href).href,
      } })
      if (error || data?.error) errors.push(`Linha ${index + 2}: ${data?.error || error.message}`); else success++
    }
    showMessage(message, `${success} participante(s) importado(s). ${errors.length ? errors.join(' | ') : ''}`, errors.length ? 'error' : 'success')
    state.lookups = {}; await renderTable()
  } catch (error) { showMessage(message, error.message, 'error') }
  finally { event.target.value = '' }
}

try {
  await requireRole(adminScope === 'observatorio' ? ['administrador', 'observatorio_admin'] : 'administrador', {
    message: adminScope === 'observatorio'
      ? 'Esta área é exclusiva da curadoria e administração do Observar.IA.'
      : 'Esta área é exclusiva da administração.'
  })
  await renderTable()
}
catch (error) { if (message) showMessage(message, error.message, 'error') }
