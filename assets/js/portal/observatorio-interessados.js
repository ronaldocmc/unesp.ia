import {requireRole,supabase,showMessage} from './supabase.js'
import {mountInterested} from './observatorio-interessados-ui.js'
try {
  await requireRole(['administrador','observatorio_admin'])
  await mountInterested(document,supabase).load()
}catch(error){const message=document.querySelector('[data-interested-message]');if(message)showMessage(message,error.message || 'Acesso indisponível.','error')}
