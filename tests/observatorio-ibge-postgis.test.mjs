import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createGeoHandler} from '../supabase/functions/observatorio-acessos-geografia/core.mjs'
test('IBGE RPC: falha, base vazia e exceção preservam visita sem inventar cidade',async()=>{
 for(const result of [{data:{}},{error:{message:'offline'}},null]){
  const calls=[]
  const handler=createGeoHandler({db:{rpc:async(name,args)=>{
   calls.push({name,args})
   if(name.includes('reservar'))return {data:{reservado:true,token:'T',dia:'2026-11-02'}}
   if(name==='observatorio_municipio_ibge'){if(result===null)throw Error('offline');return result}
   return {data:true}
  }},fetchImpl:()=>{throw Error('Não consultar terceiros')}})
  const response=await handler(new Request('https://example.com',{method:'POST',headers:{origin:'https://ronaldocmc.github.io'},body:JSON.stringify({sessao:'11111111-1111-4111-8111-111111111111',localizacao:{latitude:-22.275987,longitude:-51.498789,consentimento:'geo-navegador-v1'}})}))
  assert.equal(response.status,200)
  assert.deepEqual(calls[1].args,{p_latitude:-22.28,p_longitude:-51.5})
  assert.deepEqual(calls.at(-1).args.p_geo,{metodo:'navegador',latitude:-22.28,longitude:-51.5})
 }
})
test('Bundle pequeno e migração restrita, indexada, sem alteração de histórico',async()=>{
 const bundle=await readFile(new URL('../supabase/functions/observatorio-acessos-geografia/index.web.ts',import.meta.url),'utf8')
 assert.ok(Buffer.byteLength(bundle)<20000)
 assert.ok(!bundle.includes('const ibgeMunicipios='))
 const sql=await readFile(new URL('../supabase/migrations/202611020001_observatorio_ibge_postgis.sql',import.meta.url),'utf8')
 assert.match(sql,/enable row level security/)
 assert.match(sql,/using gist/)
 assert.match(sql,/st_containsproperly/)
 assert.match(sql,/hits=1/)
 assert.match(sql,/<>5570/)
 assert.match(sql,/grant execute.*to service_role/)
 assert.doesNotMatch(sql,/update private.observatorio_acessos_geo_dia/i)
})
