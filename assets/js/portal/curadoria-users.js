import { requireRole, supabase, showMessage } from './supabase.js'

const form = document.querySelector('[data-curadoria-form]')
const inviteForm = document.querySelector('[data-curadoria-invite-form]')
const list = document.querySelector('[data-curadoria-list]')
const message = document.querySelector('[data-curadoria-message]')
let busy = false
let authorized = false

function setBusy(value) {
  busy = value
  document.querySelectorAll('[data-curadoria-invite-form] input, [data-curadoria-invite-form] button, [data-curadoria-form] input, [data-curadoria-form] button, [data-curadoria-list] button').forEach(control => { control.disabled = value })
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

async function loadUsers() {
  list.replaceChildren()
  const users = await rpc('observatorio_listar_curadores')
  for (const user of users || []) {
    const row = document.createElement('tr')
    const date = user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : ''
    for (const value of [user.nome || '—', user.email, date]) {
      const cell = document.createElement('td')
      cell.textContent = value
      row.append(cell)
    }
    const cell = document.createElement('td')
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.textContent = 'Remover acesso'
    remove.addEventListener('click', () => revokeUser(user))
    cell.append(remove)
    row.append(cell)
    list.append(row)
  }
  if (!users?.length) {
    const row = document.createElement('tr')
    const cell = document.createElement('td')
    cell.colSpan = 4
    cell.textContent = 'Nenhum curador cadastrado.'
    row.append(cell)
    list.append(row)
  }
}

async function revokeUser(user) {
  if (!authorized || busy || !confirm(`Remover o acesso de curadoria de ${user.email}? A conta será preservada.`)) return
  setBusy(true)
  try {
    await rpc('observatorio_revogar_curadoria', { p_user_id: user.user_id })
    await loadUsers()
    showMessage(message, 'Acesso de curadoria removido.', 'success')
  } catch (error) { showMessage(message, error.message, 'error') }
  finally { setBusy(false) }
}

inviteForm.addEventListener('submit', async event => {
  event.preventDefault()
  if (!authorized || busy) return
  const nome = inviteForm.elements.nome.value.trim()
  const email = inviteForm.elements.email.value.trim().toLowerCase()
  setBusy(true)
  showMessage(message, 'Cadastrando curador e enviando convite...', 'info')
  try {
    const { data, error } = await supabase.functions.invoke('observatorio-curadores', { body: { nome, email } })
    if (error || data?.error) {
      let detail = data?.error
      if (!detail && error?.context?.json) {
        try { detail = (await error.context.json()).error } catch { /* Respostas de rede podem não conter JSON. */ }
      }
      throw new Error(detail || 'O serviço de convites está indisponível. Confira a ativação no Supabase ou tente novamente mais tarde.')
    }
    if (!data?.ok) throw new Error('O serviço não confirmou o envio do convite.')
    inviteForm.reset()
    try { await loadUsers() } catch {
      showMessage(message, 'Convite enviado e curadoria liberada. Recarregue a página para atualizar a lista.', 'success')
      return
    }
    showMessage(message, 'Curador cadastrado e convite enviado. A pessoa deve abrir o e-mail e definir sua própria senha.', 'success')
  } catch (error) { showMessage(message, error.message, 'error') }
  finally { setBusy(false) }
})

form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!authorized || busy) return
  const email = form.elements.email.value.trim().toLowerCase()
  setBusy(true)
  try {
    await rpc('observatorio_conceder_curadoria', { p_email: email })
    form.reset()
    await loadUsers()
    showMessage(message, 'Acesso liberado. O usuário pode entrar com seu e-mail e senha no painel do Observar.IA.', 'success')
  } catch (error) { showMessage(message, error.message, 'error') }
  finally { setBusy(false) }
})

document.querySelector('[data-logout]').addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.href = 'login.html'
})

setBusy(true)
try {
  await requireRole(['administrador', 'observatorio_admin'], { message: 'Somente administradores podem gerenciar usuários da curadoria.' })
  authorized = true
  await loadUsers()
} catch (error) { showMessage(message, error.message, 'error') }
finally { if (authorized) setBusy(false) }
