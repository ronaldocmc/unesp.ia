import { requireAdmin, supabase, showMessage } from './supabase.js'

const definitions = {
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
}

const state = { table: 'modulos', rows: [], editing: null, lookups: {} }
const $ = (selector) => document.querySelector(selector)
const message = $('[data-admin-message]')
const dialog = $('[data-record-dialog]')
const form = $('[data-record-form]')

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const keyOf = (row, def = definitions[state.table]) => def.pk.map(k => row[k]).join('|')

document.querySelector('[data-logout]').addEventListener('click', async () => {
  await supabase.auth.signOut(); location.href = 'login.html'
})

document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', async () => {
  document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b === button))
  state.table = button.dataset.adminTab
  await renderTable()
}))

$('[data-new-record]').addEventListener('click', () => openDialog())
$('[data-dialog-close]').addEventListener('click', () => dialog.close())
$('[data-import-button]').addEventListener('click', () => $('[data-import-file]').click())
$('[data-import-file]').addEventListener('change', importSpreadsheet)
form.addEventListener('submit', saveRecord)

async function loadLookup(table) {
  if (state.lookups[table]) return state.lookups[table]
  const select = table === 'modulos' ? 'id,codigo,descricao'
    : table === 'turmas' ? 'id,descricao'
    : table === 'participantes' ? 'id,nome,email'
    : 'id,data,turma_id'
  const { data, error } = await supabase.from(table).select(select).order('id')
  if (error) throw error
  state.lookups[table] = data
  return data
}

function lookupLabel(table, row) {
  if (table === 'modulos') return `${row.codigo} - ${row.descricao}`
  if (table === 'participantes') return `${row.nome} - ${row.email}`
  if (table === 'encontros') return `#${row.id} - ${row.data} (turma ${row.turma_id})`
  return `#${row.id} - ${row.descricao}`
}

async function renderTable() {
  const def = definitions[state.table]
  $('[data-admin-title]').textContent = def.title
  $('[data-admin-description]').textContent = def.description
  $('[data-import-button]').hidden = !def.import
  showMessage(message, 'Carregando registros...', 'info')
  const { data, error } = await supabase.from(state.table).select('*').limit(1000)
  if (error) return showMessage(message, error.message, 'error')
  state.rows = data ?? []
  const columns = [...new Set([...def.pk, ...def.fields.map(f => f[0])])]
  $('[data-admin-head]').innerHTML = `<tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}<th>Ações</th></tr>`
  $('[data-admin-body]').innerHTML = state.rows.map(row => `<tr>${columns.map(c => `<td>${escapeHtml(formatValue(row[c]))}</td>`).join('')}<td><div class="admin-table-actions"><button data-edit="${escapeHtml(keyOf(row))}">Editar</button><button data-delete="${escapeHtml(keyOf(row))}">Excluir</button></div></td></tr>`).join('') || `<tr><td colspan="${columns.length + 1}">Nenhum registro.</td></tr>`
  $('[data-admin-body]').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openDialog(findRow(b.dataset.edit))))
  $('[data-admin-body]').querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteRecord(findRow(b.dataset.delete))))
  showMessage(message, `${state.rows.length} registro(s) carregado(s).`, 'success')
}

const formatValue = value => typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : (value ?? '')
const findRow = key => state.rows.find(row => keyOf(row) === key)

async function openDialog(row = null) {
  state.editing = row
  const def = definitions[state.table]
  $('[data-dialog-title]').textContent = `${row ? 'Editar' : 'Cadastrar'} ${def.title.toLowerCase()}`
  const container = $('[data-dialog-fields]')
  container.innerHTML = ''
  for (const [name, label, type, required, source] of def.fields) {
    const value = row?.[name]
    const disabled = Boolean(row && def.pk.includes(name))
    let control
    if (type === 'textarea') control = `<textarea name="${name}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea>`
    else if (type === 'checkbox') control = `<input type="checkbox" name="${name}" ${value !== false ? 'checked' : ''}>`
    else if (type === 'select-static') control = `<select name="${name}" ${required ? 'required' : ''}>${source.map(v => `<option value="${v}" ${value === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`
    else if (type === 'select') {
      const options = await loadLookup(source)
      control = `<select name="${name}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}><option value="">Selecione</option>${options.map(o => `<option value="${o.id}" ${Number(value) === Number(o.id) ? 'selected' : ''}>${escapeHtml(lookupLabel(source, o))}</option>`).join('')}</select>${disabled ? `<input type="hidden" name="${name}" value="${value}">` : ''}`
    } else control = `<input type="${type}" name="${name}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}>${disabled ? `<input type="hidden" name="${name}" value="${escapeHtml(value)}">` : ''}`
    container.insertAdjacentHTML('beforeend', `<label>${label}${control}</label>`)
  }
  $('[data-dialog-message]').hidden = true
  dialog.showModal()
}

function formPayload(def) {
  const fd = new FormData(form); const payload = {}
  for (const [name,,type] of def.fields) {
    if (type === 'checkbox') payload[name] = form.elements[name].checked
    else if (['number','select'].includes(type) && fd.get(name) !== '') payload[name] = Number(fd.get(name))
    else payload[name] = fd.get(name) === '' ? null : fd.get(name)
  }
  if (payload.cpf) payload.cpf = String(payload.cpf).replace(/\D/g, '')
  return payload
}

async function saveRecord(event) {
  event.preventDefault()
  const def = definitions[state.table]
  const payload = formPayload(def)
  const dialogMessage = $('[data-dialog-message]')
  showMessage(dialogMessage, 'Salvando...', 'info')
  try {
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
      let query = state.editing ? supabase.from(state.table).update(payload) : supabase.from(state.table).insert(payload)
      if (state.editing) for (const pk of def.pk) query = query.eq(pk, state.editing[pk])
      const { error } = await query
      if (error) throw error
    }
    dialog.close(); state.lookups = {}; await renderTable()
  } catch (error) { showMessage(dialogMessage, error.message, 'error') }
}

async function deleteRecord(row) {
  if (!confirm('Confirma a exclusão deste registro? Relações dependentes poderão ser removidas.')) return
  try {
    if (state.table === 'participantes') {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'delete_participant', participantId: row.id } })
      if (error || data?.error) throw new Error(data?.error || error.message)
    } else {
      let query = supabase.from(state.table).delete()
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

try { await requireAdmin(); await renderTable() }
catch (error) { if (message) showMessage(message, error.message, 'error') }
