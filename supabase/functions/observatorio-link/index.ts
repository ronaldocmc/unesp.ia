import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHandler, ImportError } from './core.mjs'

Deno.serve(createHandler({
  async authorize(authorization) {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await client.auth.getUser(authorization.slice(7))
    if (error || !user) throw new ImportError('Sessão expirada. Entre novamente para continuar.', 401)
    const reservation = await client.rpc('observatorio_importador_reservar')
    if (reservation.error) throw new ImportError('Não foi possível autorizar a importação.', 503)
    if (reservation.data === 'limite') throw new ImportError('Limite de importações atingido. Aguarde um minuto.', 429)
    if (reservation.data !== 'ok') throw new ImportError('Acesso restrito à curadoria.', 403)
  },
}))
