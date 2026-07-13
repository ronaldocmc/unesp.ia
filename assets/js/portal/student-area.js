import { requireSession, supabase, showMessage } from './supabase.js'

const message = document.querySelector('[data-student-message]')
const modules = document.querySelector('[data-student-modules]')
const classes = document.querySelector('[data-student-classes]')
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char])

document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  await supabase.auth.signOut(); location.href = 'login.html'
})

try {
  const session = await requireSession()
  const { data: participant, error: participantError } = await supabase
    .from('participantes').select('id,nome').eq('auth_user_id', session.user.id).maybeSingle()
  if (participantError) throw participantError
  if (!participant) throw new Error('Seu login ainda não está vinculado a um participante.')

  const { data, error } = await supabase.from('matriculas')
    .select('status,turmas(id,descricao,data_inicio,modulos(id,codigo,descricao))')
    .eq('participante_id', participant.id).in('status', ['ativa', 'concluida'])
  if (error) throw error

  const uniqueModules = new Map()
  for (const enrollment of data) {
    const turma = enrollment.turmas
    const modulo = turma?.modulos
    if (modulo && enrollment.status === 'ativa') uniqueModules.set(modulo.id, modulo)
    classes.insertAdjacentHTML('beforeend', `<tr><td>${escapeHtml(turma?.descricao)}</td><td>${escapeHtml(modulo?.codigo)} - ${escapeHtml(modulo?.descricao)}</td><td>${escapeHtml(turma?.data_inicio)}</td><td>${escapeHtml(enrollment.status)}</td></tr>`)
  }
  for (const modulo of uniqueModules.values()) {
    modules.insertAdjacentHTML('beforeend', `<article class="student-module"><span class="badge">${escapeHtml(modulo.codigo)}</span><h3>${escapeHtml(modulo.descricao)}</h3><a class="btn" href="conteudo-modulo.html?modulo=${encodeURIComponent(modulo.id)}">Acessar conteúdo</a></article>`)
  }
  if (!uniqueModules.size) modules.innerHTML = '<p>Nenhum módulo está liberado no momento.</p>'
  showMessage(message, `Olá, ${participant.nome}. Seu acesso considera matrículas ativas e o período da turma.`, 'success')
} catch (error) {
  showMessage(message, error.message || 'Não foi possível carregar sua área.', 'error')
}
