import { assertConfigured, supabase, showMessage } from './supabase.js'

const form = document.querySelector('form[data-auth-form]')
const message = document.querySelector('[data-auth-message]')

try { assertConfigured() } catch (error) { showMessage(message, error.message, 'error') }

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
      const target = requested ? new URL(requested, location.href) : new URL('area-aluno.html', location.href)
      location.href = target.origin === location.origin ? target.href : 'area-aluno.html'
    }
    if (mode === 'forgot') {
      const redirectTo = new URL('redefinir-senha.html', location.href).href
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
      setTimeout(() => { location.href = 'login.html' }, 1200)
    }
  } catch (error) {
    showMessage(message, error.message || 'Não foi possível concluir a operação.', 'error')
  }
})
