import { requireSession, supabase } from './supabase.js'

const container = document.querySelector('[data-private-content]')
const moduloId = Number(new URLSearchParams(location.search).get('modulo'))
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char])

document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  await supabase.auth.signOut(); location.href = 'login.html'
})

try {
  await requireSession()
  if (!Number.isInteger(moduloId) || moduloId < 1) throw new Error('Módulo inválido.')
  const { data, error } = await supabase.from('conteudos_modulo')
    .select('titulo,html,storage_path,ordem').eq('modulo_id', moduloId)
    .eq('publicado', true).order('ordem')
  if (error) throw error
  if (!data?.length) throw new Error('Conteúdo indisponível ou matrícula sem permissão para este módulo.')

  container.innerHTML = ''
  for (const item of data) {
    let html = item.html
    if (item.storage_path) {
      const { data: file, error: fileError } = await supabase.storage
        .from('conteudos-modulos').download(item.storage_path)
      if (fileError) throw fileError
      html = await file.text()
    }
    container.insertAdjacentHTML('beforeend', `<section class="private-module-section"><h1>${escapeHtml(item.titulo)}</h1>${html}</section>`)
  }
  document.dispatchEvent(new CustomEvent('private-content-loaded'))
} catch (error) {
  container.innerHTML = `<div class="callout warn"><h1>Acesso não liberado</h1><p>${escapeHtml(error.message)}</p><a href="area-aluno.html">Voltar à minha área</a></div>`
}
