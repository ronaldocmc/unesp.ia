import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHandler, ImportError } from './core.mjs'

Deno.serve(createHandler({
  async authorize(authorization) {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await client.auth.getUser(authorization.slice(7))
    if (error || !user) throw new ImportError('Sessão expirada. Entre novamente no painel.', 401)
    const { data: role, error: roleError } = await client.from('papeis_usuario')
      .select('papel').eq('user_id', user.id).eq('papel', 'administrador').maybeSingle()
    if (roleError || !role) throw new ImportError('Acesso permitido somente a administradores.', 403)
  },
}))
