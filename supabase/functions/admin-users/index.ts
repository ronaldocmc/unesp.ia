import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const publishable = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization = req.headers.get('Authorization') ?? ''

  const caller = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authError } = await caller.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401)

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } })
  const { data: role } = await admin.from('papeis_usuario')
    .select('papel').eq('user_id', authData.user.id).eq('papel', 'administrador').maybeSingle()
  if (!role) return json({ error: 'Acesso restrito à administração' }, 403)

  const payload = await req.json()
  const action = String(payload.action ?? '')

  if (action === 'create_participant') {
    const p = payload.participant ?? {}
    const email = String(p.email ?? '').trim().toLowerCase()
    if (!email || !p.nome || !p.cpf) return json({ error: 'Nome, CPF e e-mail são obrigatórios' }, 422)

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: payload.redirectTo,
      data: { nome: String(p.nome).trim() },
    })
    if (inviteError) return json({ error: inviteError.message }, 400)

    const row = {
      auth_user_id: invited.user.id,
      nome: String(p.nome).trim(),
      cpf: String(p.cpf).replace(/\D/g, ''),
      telefone: p.telefone || null,
      email,
      genero: p.genero || null,
      escolaridade: p.escolaridade || null,
      endereco: p.endereco || null,
      ativo: p.ativo !== false,
    }
    const { data, error } = await admin.from('participantes').insert(row).select().single()
    if (error) {
      await admin.auth.admin.deleteUser(invited.user.id)
      return json({ error: error.message }, 400)
    }
    return json({ participant: data }, 201)
  }

  if (action === 'update_participant_email') {
    const participantId = Number(payload.participantId)
    const email = String(payload.email ?? '').trim().toLowerCase()
    const { data: participant } = await admin.from('participantes')
      .select('auth_user_id').eq('id', participantId).single()
    if (!participant?.auth_user_id) return json({ error: 'Participante sem conta de acesso' }, 404)
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      participant.auth_user_id, { email }
    )
    if (authUpdateError) return json({ error: authUpdateError.message }, 400)
    const { data, error } = await admin.from('participantes')
      .update({ email }).eq('id', participantId).select().single()
    return error ? json({ error: error.message }, 400) : json({ participant: data })
  }

  if (action === 'delete_participant') {
    const participantId = Number(payload.participantId)
    const { data: participant } = await admin.from('participantes')
      .select('auth_user_id').eq('id', participantId).single()
    const { error } = await admin.from('participantes').delete().eq('id', participantId)
    if (error) return json({ error: error.message }, 400)
    if (participant?.auth_user_id) await admin.auth.admin.deleteUser(participant.auth_user_id)
    return json({ deleted: true })
  }

  return json({ error: 'Ação desconhecida' }, 400)
})
