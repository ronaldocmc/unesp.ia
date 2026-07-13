import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, configReady } from './config.js'

export const supabase = configReady()
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export function assertConfigured() {
  if (!supabase) throw new Error('Configure a URL e a chave publicável do Supabase em assets/js/portal/config.js.')
  return supabase
}

export async function requireSession(returnTo = location.href) {
  const client = assertConfigured()
  const { data: { session } } = await client.auth.getSession()
  if (!session) {
    location.href = `login.html?returnTo=${encodeURIComponent(returnTo)}`
    throw new Error('Autenticação necessária')
  }
  return session
}

export async function requireAdmin() {
  const session = await requireSession()
  const { data, error } = await supabase.from('papeis_usuario')
    .select('papel').eq('user_id', session.user.id).eq('papel', 'administrador').maybeSingle()
  if (error || !data) {
    document.body.innerHTML = '<main class="container content"><h1>Acesso negado</h1><p>Esta área é exclusiva da administração.</p><a href="index.html">Voltar ao portal</a></main>'
    throw error ?? new Error('Usuário não é administrador')
  }
  return session
}

export function showMessage(element, message, type = 'info') {
  element.textContent = message
  element.className = `portal-message ${type}`
  element.hidden = false
}
