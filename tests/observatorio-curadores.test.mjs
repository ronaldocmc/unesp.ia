import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../supabase/functions/observatorio-curadores/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*\r?\n/m, '')

function setup(options = {}) {
  const calls = { invites: [], grants: [], clients: 0 }
  const caller = {
    auth: { getUser: async () => ({ data: { user: options.invalidSession ? null : { id: 'admin-id' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { papel: options.role || 'administrador' }, error: null }) }) }) }),
    rpc: async (name, args) => {
      if (name === 'observatorio_listar_curadores') return { error: options.missingMigration ? { message: 'not found' } : null }
      calls.grants.push(args)
      return { error: options.grantError ? { message: 'Perfil existente' } : null }
    },
  }
  const admin = { auth: { admin: { inviteUserByEmail: async (email, args) => {
    calls.invites.push({ email, ...args })
    return options.inviteError ? { error: options.inviteError } : { data: { user: { id: 'curator-id' } }, error: null }
  } } } }
  let handler
  vm.runInNewContext(source, {
    URL, Response,
    createClient: () => (++calls.clients === 1 ? caller : admin),
    Deno: {
      env: { get: key => ({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-key', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' })[key] },
      serve: value => { handler = value },
    },
  })
  return { handler, calls }
}

function request(body = { nome: 'Pessoa Curadora', email: 'curador@example.org' }, token = 'Bearer valid-jwt') {
  return new Request('https://project.supabase.co/functions/v1/observatorio-curadores', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

test('não envia convites sem JWT ou com sessão inválida', async () => {
  for (const options of [{}, { invalidSession: true }]) {
    const { handler, calls } = setup(options)
    const response = await handler(request(undefined, options.invalidSession ? 'Bearer bad-token' : ''))
    assert.equal(response.status, 401)
    assert.equal(calls.invites.length, 0)
    assert.equal(calls.grants.length, 0)
  }
})

test('curador e instrutor não podem criar contas ou atribuir perfis', async () => {
  for (const role of ['observatorio_curador', 'instrutor']) {
    const { handler, calls } = setup({ role })
    assert.equal((await handler(request())).status, 403)
    assert.equal(calls.invites.length, 0)
    assert.equal(calls.grants.length, 0)
  }
})

test('administradores cadastram exclusivamente curadoria e usam destino fixo de senha', async () => {
  for (const role of ['administrador', 'observatorio_admin']) {
    const { handler, calls } = setup({ role })
    const response = await handler(request({ nome: ' Pessoa ', email: ' CURADOR@example.org ', papel: 'administrador', redirectTo: 'https://evil.example/' }))
    assert.equal(response.status, 201)
    assert.equal((await response.json()).papel, 'observatorio_curador')
    assert.equal(calls.invites[0].email, 'curador@example.org')
    assert.equal(calls.invites[0].data.nome, 'Pessoa')
    assert.equal(calls.invites[0].redirectTo, 'https://ia.fct.unesp.br/redefinir-senha.html?returnTo=administracao-observatorio.html')
    assert.equal(calls.grants[0].p_email, 'curador@example.org')
  }
})

test('validação de dados e migração impede envio antecipado', async () => {
  for (const [options, body, expected] of [
    [{}, { nome: '', email: 'bad' }, 422],
    [{}, { nome: 'a'.repeat(121), email: 'curador@example.org' }, 422],
    [{ missingMigration: true }, { nome: 'Pessoa', email: 'curador@example.org' }, 503],
  ]) {
    const { handler, calls } = setup(options)
    assert.equal((await handler(request(body))).status, expected)
    assert.equal(calls.invites.length, 0)
  }
})

test('conta existente recebe instrução para liberar perfil sem recriar ou sobrescrever', async () => {
  const { handler, calls } = setup({ inviteError: { code: 'email_exists', message: 'Already registered' } })
  const response = await handler(request())
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /conta já existe/)
  assert.equal(calls.grants.length, 0)
})

test('falha de concessão informa convite enviado e preserva conta', async () => {
  const { handler, calls } = setup({ grantError: true })
  const response = await handler(request())
  assert.equal(response.status, 409)
  assert.equal((await response.json()).convite_enviado, true)
  assert.equal(calls.invites.length, 1)
})
