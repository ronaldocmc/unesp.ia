// Função TEMPORÁRIA: publicar como diagnostico-geografia e remover após o teste.
// Sem banco, provedor GeoIP, logs de aplicação ou retorno do IP do visitante.
// A infraestrutura ainda pode registrar metadados das requisições.
// A ausência do marcador NÃO comprova confiança em todas as rotas do gateway.
Deno.serve((req) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  if (req.method !== 'GET') return new Response(null, { status: 405, headers })
  const marcador = '203.0.113.123'
  const resultado = {}
  for (const nome of ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for']) {
    const valor = req.headers.get(nome) || ''
    resultado[nome] = {
      presente: valor.trim().length > 0,
      marcador_cliente_preservado: valor.includes(marcador),
    }
  }
  return new Response(JSON.stringify({
    diagnostico: 'geografia-v1',
    cabecalhos: resultado,
    aviso: 'Teste pontual; não comprova o contrato de confiança de todas as rotas.',
  }), { status: 200, headers })
})
