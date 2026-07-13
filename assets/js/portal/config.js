// Preencha apenas com valores públicos do Supabase. Nunca use secret/service_role aqui.
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'SUA_CHAVE_PUBLICAVEL'

export function configReady() {
  return !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_PUBLISHABLE_KEY.includes('SUA_CHAVE')
}
