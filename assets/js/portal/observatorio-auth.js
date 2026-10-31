import {assertConfigured,supabase,showMessage} from './supabase.js'
import {safeAccountReturn,signupInput,googleAvailable} from './observatorio-conta-model.js'
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js'
const message=document.querySelector('[data-account-message]')
const requested=new URLSearchParams(location.search).get('returnTo')
const target=safeAccountReturn(requested,location.href)
let busy=false
const buttons=[...document.querySelectorAll('button')]
const googleButton=document.querySelector('[data-google-login]')
let googleReady=false
async function run(action) {
  if (busy) return
  busy=true; buttons.forEach(b=>{b.disabled=true})
  try {assertConfigured(); await action()}
  catch {showMessage(message,'Não foi possível entrar ou criar a conta. Confira os dados e a confirmação de e-mail; se já possui conta, entre ou recupere sua senha. O acesso Google depende de estar habilitado pela administração.','error')}
  finally {busy=false;buttons.forEach(b=>{b.disabled=b===googleButton&&!googleReady})}
}
document.querySelector('[data-observer-login]').addEventListener('submit',event=>{
  event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget))
  void run(async()=>{
    const {error}=await supabase.auth.signInWithPassword({email:String(values.email).trim().toLowerCase(),password:String(values.password)})
    if(error) throw error
    location.assign(target)
  })
})
document.querySelector('[data-observer-signup]').addEventListener('submit',event=>{
  event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget))
  let input
  try {input=signupInput(values)} catch(error) {showMessage(message,error.message,'error');return}
  void run(async()=>{
    input.options.emailRedirectTo=target
    const {data,error}=await supabase.auth.signUp(input)
    if(error) throw error
    if(data.session) location.assign(target)
    else showMessage(message,'Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Confira sua caixa de entrada e spam. Se já possui conta, use Entrar ou recupere sua senha. Nenhuma assinatura foi ativada.','success')
  })
})
googleButton.addEventListener('click',()=>{if(!googleReady)return;void run(async()=>{
  const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:target}})
  if(error) throw error
})})
const recovery=new URL('esqueci-senha.html',location.href); recovery.searchParams.set('returnTo',target)
document.querySelector('[data-account-recover]').href=recovery.href
try {
  assertConfigured(); const {data:{session}}=await supabase.auth.getSession()
  if(session) location.replace(target)
  else {
    googleReady=await googleAvailable(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY)
    googleButton.disabled=busy||!googleReady
    document.querySelector('[data-google-status]').textContent=googleReady?'Você também pode usar sua conta Google.':'Google indisponível no momento. Use e-mail e senha; a administração precisa habilitar o provedor para liberar essa opção.'
  }
}
catch {showMessage(message,'Acesso indisponível no momento. Tente novamente mais tarde.','error')}
