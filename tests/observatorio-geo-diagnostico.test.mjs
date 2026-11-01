import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('Diagnóstico temporário não expõe IP nem consulta banco ou provedor', async () => {
  let handler
  const source = readFileSync(new URL('../supabase/setup/geografia_diagnostico_temporario.ts', import.meta.url), 'utf8')
  vm.runInNewContext(source, { Deno: { serve: fn => { handler = fn } }, Response })
  const baseline = await handler(new Request('https://example.com', {
    headers: { 'cf-connecting-ip': '8.8.4.4' },
  }))
  const text = await baseline.text()
  assert.ok(!text.includes('8.8.4.4'))
  assert.equal(baseline.headers.get('cache-control'), 'no-store')
  const body = JSON.parse(text)
  assert.equal(body.cabecalhos['cf-connecting-ip'].presente, true)
  assert.equal(body.cabecalhos['x-real-ip'].presente, false)
  const forged = await handler(new Request('https://example.com', {
    headers: { 'x-forwarded-for': '203.0.113.123, 8.8.4.4' },
  }))
  assert.equal((await forged.json()).cabecalhos['x-forwarded-for'].marcador_cliente_preservado, true)
  assert.equal((await handler(new Request('https://example.com', { method: 'POST' }))).status, 405)
})
