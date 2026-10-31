import {requireSession,supabase,showMessage} from './supabase.js'
import {mountAccount} from './observatorio-conta-ui.js'
try {
  await requireSession(location.href,{loginPage:'participar-observatorio.html'})
  document.querySelector('[data-account-logout]').addEventListener('click',async()=>{
    const {error}=await supabase.auth.signOut()
    if(error){showMessage(document.querySelector('[data-account-message]'),'Não foi possível sair. Tente novamente.','error');return}
    location.href='observatorio.html'
  })
  await mountAccount(document,supabase).load()
}catch(error){showMessage(document.querySelector('[data-account-message]'),error.message || 'Acesso indisponível.','error')}
