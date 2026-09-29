// Preencha apenas com valores públicos do Supabase. Nunca use secret/service_role aqui.
export const SUPABASE_URL = 'https://brdjzyutqdakabaolxiy.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Mmfrykw1g9WnX-ZhkFP8lA_Wd9Xq8w6'

export function configReady() {
  return !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_PUBLISHABLE_KEY.includes('SUA_CHAVE')
}
