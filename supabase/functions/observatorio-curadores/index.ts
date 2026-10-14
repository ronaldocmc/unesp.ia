// Arquivo único: pode ser colado como index.ts no editor do Supabase Web.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const authorization = req.headers.get('Authorization') || ''
  if (!/^Bearer \S+$/i.test(authorization)) return json({ error: 'Entre novamente para continuar.' }, 401)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) return json({ error: 'Serviço de convites não configurado.' }, 503)
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await caller.auth.getUser(authorization.slice(7))
    if (authError || !authData?.user) return json({ error: 'Sessão expirada. Entre novamente.' }, 401)
    const { data: role, error: roleError } = await caller.from('papeis_usuario')
      .select('papel').eq('user_id', authData.user.id).maybeSingle()
    if (roleError || !['administrador', 'observatorio_admin'].includes(role?.papel)) {
      return json({ error: 'Somente administradores podem cadastrar curadores.' }, 403)
    }

    let payload
    try { payload = await req.json() } catch { return json({ error: 'Informe nome e e-mail válidos.' }, 400) }
    const nome = typeof payload?.nome === 'string' ? payload.nome.trim() : ''
    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : ''
    if (!nome || nome.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Informe nome (até 120 caracteres) e e-mail válidos.' }, 422)
    }

    // Confirma que a migração e as permissões estão ativas antes de enviar e-mail.
    const { error: setupError } = await caller.rpc('observatorio_listar_curadores')
    if (setupError) return json({ error: 'Não foi possível verificar as permissões. Confira se o SQL de curadoria foi aplicado no Supabase.' }, 503)
    const site = new URL(Deno.env.get('CURADORIA_SITE_URL') || 'https://ia.fct.unesp.br/')
    if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash) {
      return json({ error: 'Endereço do portal para os convites não configurado corretamente.' }, 503)
    }
    if (!site.pathname.endsWith('/')) site.pathname += '/'
    const redirect = new URL('redefinir-senha.html', site)
    redirect.searchParams.set('returnTo', 'administracao-observatorio.html')
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome }, redirectTo: redirect.href,
    })
    if (inviteError) {
      const exists = ['email_exists', 'user_already_exists', 'identity_already_exists'].includes(inviteError.code)
      return json({ error: exists ? 'Esta conta já existe. Use “Liberar acesso para conta existente” abaixo.' : inviteError.message }, exists ? 409 : 400)
    }
    if (!invited?.user?.id) return json({ error: 'O serviço não confirmou a criação da conta.' }, 502)

    // Usa a sessão do administrador e a RPC que preserva outros perfis existentes.
    const { error: grantError } = await caller.rpc('observatorio_conceder_curadoria', { p_email: email })
    if (grantError) return json({
      error: `O convite foi enviado, mas o acesso de curadoria não foi liberado: ${grantError.message}. Use a opção de conta existente para concluir a liberação.`,
      convite_enviado: true,
    }, 409)
    return json({ ok: true, email, convite_enviado: true, papel: 'observatorio_curador' }, 201)
  } catch {
    return json({ error: 'Não foi possível concluir o cadastro. Confira a conta na lista antes de tentar novamente.' }, 500)
  }
})
