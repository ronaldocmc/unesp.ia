import { assertConfigured, supabase, showMessage } from './supabase.js'
import { safeAccountReturn } from './observatorio-conta-model.js'

const form = document.querySelector('form[data-auth-form]')
const message = document.querySelector('[data-auth-message]')

try { assertConfigured() } catch (error) { showMessage(message, error.message, 'error') }
if (form?.dataset.authForm === 'login') {
  const link=document.createElement('a');link.textContent='Participar do Observar.IA: criar conta ou entrar com Google'
  link.href='participar-observatorio.html'
  const requested=new URLSearchParams(location.search).get('returnTo')
  if(requested){const url=new URL(link.href,location.href);url.searchParams.set('returnTo',safeAccountReturn(requested,location.href));link.href=url.href}
  form.after(link)
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const values = Object.fromEntries(new FormData(form))
  const mode = form.dataset.authForm
  showMessage(message, 'Processando...', 'info')

  try {
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(values.email).trim().toLowerCase(), password: String(values.password),
      })
      if (error) throw error
      const requested = new URLSearchParams(location.search).get('returnTo')
      location.href = safeAccountReturn(requested, location.href, 'area-aluno.html')
    }
    if (mode === 'forgot') {
      const redirect = new URL('redefinir-senha.html', location.href)
      const requested = new URLSearchParams(location.search).get('returnTo')
      if(requested)redirect.searchParams.set('returnTo',safeAccountReturn(requested,location.href))
      const redirectTo = redirect.href
      const { error } = await supabase.auth.resetPasswordForEmail(
        String(values.email).trim().toLowerCase(), { redirectTo }
      )
      if (error) throw error
      showMessage(message, 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.', 'success')
      form.reset()
    }
    if (mode === 'reset') {
      if (values.password !== values.confirm_password) throw new Error('As senhas não coincidem.')
      if (String(values.password).length < 8) throw new Error('Use pelo menos 8 caracteres.')
      const { error } = await supabase.auth.updateUser({ password: String(values.password) })
      if (error) throw error
      showMessage(message, 'Senha atualizada. Redirecionando para o login...', 'success')
      const requested = new URLSearchParams(location.search).get('returnTo')
      const login = new URL('login.html', location.href)
      if (requested) {
        const target = new URL(requested, location.href)
        if (target.origin === location.origin) login.searchParams.set('returnTo', target.href)
      }
      setTimeout(() => { location.href = login.href }, 1200)
    }
  } catch (error) {
    showMessage(message, error.message || 'Não foi possível concluir a operação.', 'error')
  }
})
