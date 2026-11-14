import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { approximatePosition,createGeoCollection } from '../assets/js/observatorio-geografia.js'
import { createGeoHandler } from '../supabase/functions/observatorio-acessos-geografia/core.mjs'
import { mapPlaces,geoMethodLabel,geoMethodTotals } from '../assets/js/portal/observatorio-acessos-mapa.js'
const tick=()=>new Promise(r=>setImmediate(r))
const id='11111111-1111-4111-8111-111111111111'
test('Contagem por método não infere IP pela cidade nem mistura histórico',()=>{
  assert.deepEqual(geoMethodTotals([
    {metodo:'navegador',quantidade:2},{metodo:'ip',quantidade:'3'},
    {metodo:'legado',quantidade:4},{metodo:'nao_identificado',quantidade:1},
    {cidade:'Regente Feijó',quantidade:10},{metodo:'desconhecido',quantidade:1},
    {metodo:'ip',quantidade:-1}
  ]),{navegador:2,ip:3,legado:4,nao_identificado:1,nao_registrado:11})
})

test('Navegador: pedido automático único, arredondamento, serialização com IP e recusa',async()=>{
  const status={}
  let success,failure,requests=0;const calls=[]
  const collection=createGeoCollection({status,send:async body=>{calls.push(body)},
    geolocation:{getCurrentPosition(ok,no,options){requests++;success=ok;failure=no;assert.equal(options.timeout,8000)}}})
  assert.equal(requests,1)
  await collection.visit(id);assert.deepEqual(calls,[{sessao:id}])
  await success({coords:{latitude:-22.275987,longitude:-51.498789,accuracy:30}})
  assert.deepEqual(calls[1].localizacao,{latitude:-22.28,longitude:-51.5,consentimento:'geo-navegador-v1'})
  assert.ok(!JSON.stringify(calls).includes('-22.275987'))
  assert.equal(approximatePosition({latitude:999,longitude:0,accuracy:10}),null)
  assert.equal(approximatePosition({latitude:10,longitude:0,accuracy:30000}),null)
  await collection.visit(id);assert.equal(requests,1)
  const denied=createGeoCollection({status,send:async body=>calls.push(body),geolocation:{getCurrentPosition(ok,no){no({code:1})}}})
  await denied.visit(id);assert.deepEqual(calls.at(-1),{sessao:id})
  assert.match(status.textContent,/alternativa por IP/)
  const unavailable=createGeoCollection({send:async body=>calls.push(body)})
  await unavailable.visit(id);assert.deepEqual(calls.at(-1),{sessao:id})
})

test('Edge: navegador não consulta terceiros e valida payload/consentimento',async()=>{
  const calls=[];let external=0
  const handler=createGeoHandler({env:{},fetchImpl:async()=>{external++;throw new Error()},db:{rpc:async(name,args)=>{
      calls.push({name,args});return name.includes('reservar')?{data:{reservado:true,consultar:true,token:'T',dia:'2026-10-31'}}:name==='observatorio_municipio_ibge'?{data:{pais:'BR',regiao:'São Paulo',cidade:'Pirapozinho',codigo_ibge:'3539202',base_geografica:'IBGE-malhas-2022-simplificada'}}:{data:true}
  }}})
  const req=localizacao=>new Request('https://example.com',{method:'POST',headers:{origin:'https://ronaldocmc.github.io'},body:JSON.stringify({sessao:id,localizacao})})
  const point={latitude:-22.275987,longitude:-51.498789,consentimento:'geo-navegador-v1'}
  assert.equal((await handler(req(point))).status,200);assert.equal(external,0)
  assert.equal(calls[0].name,'observatorio_acesso_geo_reservar_v2')
  assert.equal(calls[0].args.p_consultar,false)
  assert.deepEqual(calls.at(-1).args.p_geo,{metodo:'navegador',latitude:-22.28,longitude:-51.5,pais:'BR',regiao:'São Paulo',cidade:'Pirapozinho',codigo_ibge:'3539202',base_geografica:'IBGE-malhas-2022-simplificada'})
  for(const invalid of [{...point,consentimento:''},{...point,latitude:91},{...point,latitude:'10'},{...point,email:'x'},null]){
    assert.equal((await handler(req(invalid))).status,400)
  }
  assert.equal(mapPlaces([{pais:'',metodo:'navegador',latitude:0,longitude:0,quantidade:1}]).length,1)
  assert.match(geoMethodLabel('legado'),/não registrado/)
})

test('Banco: migração preserva histórico, método, upgrade sem duplicação e permissões',{skip:!process.env.RADAR_PGLITE_MODULE},async()=>{
 const {PGlite}=await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href),db=new PGlite()
 const sql=file=>readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
   create function private.is_observatorio_admin() returns boolean language sql as $$select current_setting('test.admin',true)='yes'$$;
   create table public.observatorio_conteudos(id bigint primary key,titulo text,status text,revisao_humana boolean);`)
  await db.exec(sql('202610220001_observatorio_acessos.sql'));await db.exec(sql('202610310002_observatorio_acessos_geografia.sql'))
  await db.exec("insert into private.observatorio_acessos_geo_dia values(current_date,'BR','SP','Histórico',-22,-51,2)")
  const migration=sql('202610310003_observatorio_geografia_metodos.sql');await db.exec(migration);await db.exec(migration)
  const ibgeMigration=sql('202611010001_observatorio_geografia_ibge.sql');await db.exec(ibgeMigration);await db.exec(ibgeMigration)
  assert.equal((await db.query("select metodo from private.observatorio_acessos_geo_dia")).rows[0].metodo,'legado')
  const visit=async session=>db.query("select public.observatorio_acesso_registrar($1,'visita',0)",[session])
  const reserve=async(browser=false)=>(await db.query('select public.observatorio_acesso_geo_reservar_v2($1,false,$2) as r',[id,browser])).rows[0].r
  const finish=async(lease,geo)=>(await db.query('select public.observatorio_acesso_geo_finalizar($1,$2,$3,$4,0) as r',[id,lease.token,lease.dia,geo])).rows[0].r
  await db.exec('set role anon');await visit(id);await assert.rejects(reserve(),/permission denied/)
  await db.exec('reset role;set role service_role')
  const ip=await reserve();assert.equal(await finish(ip,{pais:'BR',cidade:'Regente Feijó',metodo:'ip',latitude:-22.1,longitude:-51.1}),true)
  assert.equal((await reserve()).reservado,false)
  const browser=await reserve(true);assert.equal(browser.reservado,true);assert.equal(browser.consultar,false)
  assert.equal((await reserve(true)).reservado,false)
  const geo={metodo:'navegador',latitude:-22.275987,longitude:-51.498789,pais:'BR',regiao:'São Paulo',cidade:'Pirapozinho',codigo_ibge:'3539202',base_geografica:'IBGE-malhas-2022-simplificada'}
  assert.equal(await finish(browser,geo),true);assert.equal(await finish(browser,geo),false)
  assert.equal((await reserve(true)).reservado,false);assert.equal((await reserve()).reservado,false)
  await db.exec('reset role')
  assert.equal((await db.query("select count(*)::int as n from private.observatorio_acessos_geo_dia where metodo='ip'")).rows[0].n,0)
  const row=(await db.query("select * from private.observatorio_acessos_geo_dia where metodo='navegador'")).rows[0]
  assert.equal(Number(row.latitude),-22.28);assert.equal(row.pais,'BR');assert.equal(Number(row.quantidade),1)
  assert.equal(row.codigo_ibge,'3539202');assert.equal(row.cidade,'Pirapozinho');assert.equal(row.base_geografica,'IBGE-malhas-2022-simplificada')
  assert.equal((await db.query('select consultas from private.observatorio_geo_controle')).rows[0].consultas,0)
  await db.exec("set role authenticated;select set_config('test.admin','yes',false)")
  const report=(await db.query('select public.observatorio_acessos_geografia(current_date-1,current_date+1) as r')).rows[0].r
  assert.equal(Number(report.geografia_registrada),3) // dois antigos + uma visita, sem duplicação
  assert.ok(report.locais.some(x=>x.metodo==='navegador'))
  assert.ok(report.locais.some(x=>x.codigo_ibge==='3539202'&&x.base_geografica==='IBGE-malhas-2022-simplificada'))
  assert.ok(!JSON.stringify(report).includes(id))
 }finally{await db.close()}
})
