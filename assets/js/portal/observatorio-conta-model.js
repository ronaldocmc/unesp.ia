export const CONSENT_VERSION = 'observar-dia-20261031'
export const CONSENT_TEXT = 'Quero receber o Observar.Dia por e-mail, com o resumo diário das observações. Posso cancelar nesta área a qualquer momento.'
export async function googleAvailable(url,publishableKey,fetchImpl=globalThis.fetch) {
  try {
    const response=await fetchImpl(`${url}/auth/v1/settings`,{headers:{apikey:publishableKey},signal:AbortSignal.timeout(5000)})
    if(!response.ok)return false
    const settings=await response.json()
    return settings?.external?.google===true
  }catch{return false}
}
export function safeAccountReturn(requested, currentURL, fallback = 'minha-conta-observatorio.html') {
  const base = new URL(currentURL), safe = new URL(fallback,base)
  try {
    const target = new URL(requested || fallback,base)
    return ['http:','https:'].includes(target.protocol) && target.origin===base.origin && !target.username && !target.password ? target.href : safe.href
  } catch { return safe.href }
}
export function signupInput(values) {
  const nome=String(values.nome || '').trim(), email=String(values.email || '').trim().toLowerCase(), password=String(values.password || '')
  if (nome.length<2 || nome.length>120) throw new Error('Informe seu nome entre 2 e 120 caracteres.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.')
  if (password.length<8) throw new Error('Use uma senha com pelo menos 8 caracteres.')
  if (password!==values.confirm_password) throw new Error('As senhas não coincidem.')
  return {email,password,options:{data:{nome}}}
}
export const suggestionLabel = value => ({aguardando_revisao:'Aguardando revisão',publicada:'Publicada',nao_selecionada:'Não selecionada'})[value] || 'Aguardando revisão'
export async function saveAccount(db,nome,assinatura) {
  const {data,error}=await db.rpc('observatorio_salvar_conta',{p_nome:nome.trim(),p_assinatura:assinatura,p_consentimento:assinatura?CONSENT_VERSION:null})
  if (error) throw error
  return data
}
