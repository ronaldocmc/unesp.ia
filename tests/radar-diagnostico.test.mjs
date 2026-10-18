import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRadarLinkDiagnostic, readRadarFunctionError } from '../assets/js/portal/radar-diagnostico.js'

test('diagnóstico usa lista fechada de campos e não copia segredos, URLs completas ou dados pessoais', () => {
  const result = buildRadarLinkDiagnostic({
    inputURL: 'https://news.google.com/rss/articles/secret-path?token=private-token#private',
    data: { acao: 'resolver_link_google', resolvido: false, url: 'https://obia.nic.br/private-path?key=secret',
      diagnostico: 'pagina: HTTP 429 secret-token', authorization: 'Bearer secret', email: 'private@example.org',
      user_id: 'private-id', nested: { token: 'secret' } },
    error: null, httpStatus: 200,
  })
  assert.equal(result.motivo, 'google_limite_de_acessos_429')
  assert.equal(result.dominio_entrada, 'news.google.com')
  assert.equal(result.dominio_resultado, 'obia.nic.br')
  assert.doesNotMatch(JSON.stringify(result), /secret|private|Bearer|authorization|email|user_id/)
})

test('distingue resolução, backend antigo, autenticação e erro de rede', () => {
  assert.equal(buildRadarLinkDiagnostic({ data: { acao: 'resolver_link_google', resolvido: true } }).estado, 'resolvido')
  const old = buildRadarLinkDiagnostic({ data: { ok: true, previas: [{ url: 'private' }] } })
  assert.equal(old.estado, 'resposta_incompativel'); assert.equal(old.resposta_de_busca, true)
  assert.equal(buildRadarLinkDiagnostic({ error: {}, httpStatus: 403 }).motivo, 'permissao')
  assert.equal(buildRadarLinkDiagnostic({ error: new Error('secret') }).estado, 'erro_rede_ou_cors')
  assert.equal(buildRadarLinkDiagnostic({ inputURL: 'https://user:pass@example.org' }).dominio_entrada, null)
})

test('lê status HTTP e JSON limitado; aceita resposta inválida sem expor corpo', async () => {
  const error = { context: Response.json({ error: 'token' }, { status: 401 }) }
  const result = await readRadarFunctionError(error)
  assert.equal(result.httpStatus, 401)
  assert.equal(buildRadarLinkDiagnostic({ ...result, error }).motivo, 'autenticacao')
  assert.deepEqual(await readRadarFunctionError({ context: new Response('x'.repeat(9000), { status: 502 }) }), { httpStatus: 502, data: null })
  assert.deepEqual(await readRadarFunctionError({ context: new Response('not JSON', { status: 500 }) }), { httpStatus: 500, data: null })
  assert.deepEqual(await readRadarFunctionError(new Error('secret')), { httpStatus: null, data: null })
})
