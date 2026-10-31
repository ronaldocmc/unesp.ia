import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {publicIP,requestIP,normalizeGeo,createGeoHandler} from '../supabase/functions/observatorio-acessos-geografia/core.mjs'
import {mapPlaces,mountGeoReport,renderGeoMap} from '../assets/js/portal/observatorio-acessos-mapa.js'

const session='11111111-1111-4111-8111-111111111111'
test('GeoIP: sem confiança implícita, sem IP privado e coordenadas limitadas',()=>{
  for(const ip of ['127.0.0.1','10.1.1.1','172.16.1.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','198.51.100.1','203.0.113.1','::1','fc00::1','fe80::1','2001:db8::1','::ffff:8.8.8.8','x'])assert.equal(publicIP(ip),null)
  assert.equal(publicIP('8.8.8.8'),'8.8.8.8');assert.equal(publicIP('2606:4700:4700::1111'),'2606:4700:4700::1111')
  const headers=new Headers({'x-real-ip':'8.8.8.8','x-forwarded-for':'1.1.1.1, 8.8.8.8'})
  assert.equal(requestIP(headers,{}),null)
  assert.equal(requestIP(headers,{GEO_TRUSTED_INGRESS:'true',GEO_IP_HEADER:'x-real-ip'}),'8.8.8.8')
  assert.equal(requestIP(headers,{GEO_TRUSTED_INGRESS:'true',GEO_IP_HEADER:'x-forwarded-for'}),null)
  assert.equal(requestIP(headers,{GEO_TRUSTED_INGRESS:'true',GEO_IP_HEADER:'x-forwarded-for',GEO_XFF_INDEX_FROM_RIGHT:'0'}),'8.8.8.8')
  const result=normalizeGeo({success:true,country_code:'BR',city:'Cidade',region:'SP',latitude:-22.123456,longitude:-51.456789,ip:'8.8.8.8',postal:'SECRET',connection:{isp:'SECRET'}})
  assert.deepEqual(result,{pais:'BR',regiao:'SP',cidade:'Cidade',latitude:-22.1,longitude:-51.5})
  assert.deepEqual(normalizeGeo({success:false,country_code:'BR'}),{})
  assert.ok(!('latitude' in normalizeGeo({success:true,country_code:'BR',latitude:999,longitude:999})))
})

test('Edge geografia: reserva, limites, erros e nenhuma localização fornecida pelo visitante',async()=>{
  const calls=[],lookups=[];let duplicate=false,fail=false,providerStatus=200
  const db={rpc:async(name,args)=>{calls.push({name,args});if(fail)return {error:true};return name.endsWith('reservar')?{data:{reservado:!duplicate,consultar:args.p_consultar,token:'TOKEN',dia:'2026-10-31'}}:{data:true}}}
  const env={GEO_TRUSTED_INGRESS:'true',GEO_IP_HEADER:'x-real-ip',GEO_PROVIDER:'ipwhois',GEO_PROVIDER_ENABLED:'true'}
  const fetchImpl=async(url,options)=>{lookups.push({url,options});return new Response(JSON.stringify({success:true,country_code:'BR',region:'SP',city:'Cidade',latitude:-22.12345,longitude:-51.12345}),{status:providerStatus,headers:{'retry-after':'3600'}})}
  const handler=createGeoHandler({db,env,fetchImpl})
  const req=(body={sessao:session},headers={})=>new Request('https://example.org',{method:'POST',headers:{origin:'https://ia.fct.unesp.br','x-real-ip':'8.8.8.8',...headers},body:JSON.stringify(body)})
  let response=await handler(req());assert.equal(response.status,200)
  assert.equal(lookups.length,1);assert.match(lookups[0].url,/^https:\/\/ipwho.is\/8.8.8.8\?/)
  assert.equal(lookups[0].options.redirect,'error')
  const finalized=calls.at(-1).args;assert.equal(finalized.p_geo.latitude,-22.1)
  assert.ok(!JSON.stringify(calls).includes('8.8.8.8'))
  assert.ok(!JSON.stringify(await response.json()).includes('Cidade'))
  duplicate=true;await handler(req());assert.equal(lookups.length,1);duplicate=false
  await createGeoHandler({db,env:{},fetchImpl})(req());assert.equal(calls.at(-1).args.p_geo.pais,undefined);assert.equal(lookups.length,1)
  assert.equal((await handler(req({sessao:session,ip:'1.1.1.1'}))).status,400)
  assert.equal((await handler(req({sessao:'bad'}))).status,400)
  assert.equal((await handler(req({sessao:session},{origin:'https://evil.org'}))).status,403)
  assert.equal((await handler(req({sessao:session},{dnt:'1'}))).status,204)
  assert.equal((await handler(req({sessao:session},{'sec-gpc':'1'}))).status,204)
  providerStatus=429;await handler(req());assert.equal(calls.at(-1).args.p_pausa_segundos,3600);assert.deepEqual(calls.at(-1).args.p_geo,{})
  const broken=createGeoHandler({db,env,fetchImpl:async()=>{throw new Error('timeout')}})
  await broken(req());assert.equal(calls.at(-1).args.p_pausa_segundos,60)
  await createGeoHandler({db,env,fetchImpl:async()=>new Response('x'.repeat(11000))})(req());assert.equal(calls.at(-1).args.p_pausa_segundos,60)
  fail=true;assert.equal((await handler(req())).status,503)
})

test('PostgreSQL: geografia privada, sem duplicação, sem reconstrução e com pausa compartilhada',{skip:!process.env.RADAR_PGLITE_MODULE},async()=>{
  const {PGlite}=await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href),db=new PGlite()
  const sql=file=>readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
      create function private.is_observatorio_admin() returns boolean language sql as $$select current_setting('test.admin',true)='yes'$$;
      create table public.observatorio_conteudos(id bigint primary key,titulo text,status text,revisao_humana boolean);`)
    await db.exec(sql('202610220001_observatorio_acessos.sql'))
    const migration=sql('202610310002_observatorio_acessos_geografia.sql');await db.exec(migration);await db.exec(migration)
    const reserve=async(id=session,consult=true)=>(await db.query('select public.observatorio_acesso_geo_reservar($1,$2) as r',[id,consult])).rows[0].r
    const finish=async(id,lease,geo={},pause=0)=>(await db.query('select public.observatorio_acesso_geo_finalizar($1,$2,$3,$4,$5) as r',[id,lease.token,lease.dia,geo,pause])).rows[0].r
    const visit=async id=>db.query("select public.observatorio_acesso_registrar($1,'visita',0)",[id])
    const report=async(filters=['','',''])=>(await db.query("select public.observatorio_acessos_geografia(current_date-1,current_date+1,$1,$2,$3) as r",filters)).rows[0].r
    await db.exec('set role anon');await visit(session)
    await assert.rejects(reserve(),/permission denied/);await assert.rejects(report(),/permission denied/)
    await db.exec('reset role;set role authenticated');await assert.rejects(reserve(),/permission denied/);await assert.rejects(report(),/Acesso restrito/)
    await assert.rejects(db.query('select * from private.observatorio_acessos_geo_dia'),/permission denied/)
    await db.exec('reset role;set role service_role')
    assert.equal((await reserve('22222222-2222-4222-8222-222222222222')).reservado,false)
    const lease=await reserve();assert.equal(lease.reservado,true);assert.equal(lease.consultar,true)
    assert.equal((await reserve()).reservado,false)
    const geo={pais:'BR',regiao:'SP',cidade:'Cidade',latitude:-22.12345,longitude:-51.12345}
    assert.equal(await finish(session,{...lease,token:'33333333-3333-4333-8333-333333333333'},geo),false)
    assert.equal(await finish(session,lease,geo),true);assert.equal(await finish(session,lease,geo),false)
    const other='22222222-2222-4222-8222-222222222222'
    await db.exec('reset role');await visit(other);await db.exec('set role service_role')
    const blocked=await reserve(other);assert.equal(blocked.consultar,false)
    assert.equal(await finish(other,blocked,{},3600),true)
    await db.exec('reset role;set role authenticated');await db.exec("select set_config('test.admin','yes',false)")
    const result=await report();assert.equal(Number(result.visitas_periodo),2);assert.equal(Number(result.localizadas),1);assert.equal(Number(result.nao_identificadas),1)
    const place=result.locais.find(r=>r.pais==='BR');assert.equal(Number(place.latitude),-22.1)
    assert.equal(Number((await report(['BR','SP','cidade'])).visitas_filtradas),1)
    assert.ok(!JSON.stringify(result).includes('token'));assert.ok(!JSON.stringify(result).includes(session))
    await assert.rejects(report(['INVALID','','']),/Filtros inválidos/)
    await db.exec('reset role')
    const id3='33333333-3333-4333-8333-333333333333';await visit(id3);await db.exec('set role service_role')
    assert.equal((await reserve(id3)).consultar,false)
    await db.exec('reset role')
    await db.exec("update private.observatorio_geo_controle set pausado_ate=null,proxima_em=now()-interval '1 second',consultas=500")
    const id4='44444444-4444-4444-8444-444444444444';await visit(id4);await db.exec('set role service_role')
    assert.equal((await reserve(id4)).consultar,false)
    await db.exec('reset role')
    await db.exec("update private.observatorio_acessos_geo_recibos set expira_em=now()-interval '1 second' where not concluido")
    await db.exec('set role service_role');assert.equal((await reserve(id3,false)).reservado,true)
  }finally{await db.close()}
})

test('Leaflet: filtros, pontos seguros, uso sob demanda e remoção ao atualizar',async()=>{
  const old=globalThis.document
  class Node{
    constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.value='';this.textContent='';this.hidden=false}
    append(...n){this.children.push(...n)}replaceChildren(...n){this.children=[];this.append(...n)}addEventListener(e,f){this.listeners[e]=f}setAttribute(){}remove(){this.removed=true}
    set innerHTML(_){throw new Error('HTML inseguro')}
  }
  const walk=n=>[n,...n.children.flatMap(walk)],text=n=>[n.textContent,...n.children.map(text)].join(' ')
  try{
    globalThis.document={createElement:t=>new Node(t)}
    let tiles,removed=0,loaded=0;const popups=[],markers=[],map={setView(){return this},fitBounds(){},invalidateSize(){},remove(){removed++}}
    const L={map:()=>map,tileLayer:(url,options)=>{tiles={url,options};return {addTo(){}}},circleMarker:(point)=>{markers.push(point);return {addTo(){return this},bindPopup(p){popups.push(p)}}}}
    const root=new Node('div'),calls=[]
    const rows=[{pais:'BR',regiao:'SP',cidade:'<img onerror=alert(1)>',latitude:-22.1,longitude:-51.1,quantidade:3},{pais:'',latitude:null,longitude:null,quantidade:1}]
    assert.equal(mapPlaces(rows).length,1);assert.equal(mapPlaces([{...rows[0],latitude:999}]).length,0)
    const view=mountGeoReport(root,{rpc:async(name,args)=>{calls.push({name,args});return {data:{locais:rows,total_locais:2,visitas_periodo:6,geografia_registrada:4,localizadas:3,nao_identificadas:1,visitas_filtradas:4}}}},{leaflet:async()=>{loaded++;return L}})
    assert.equal(loaded,0);assert.equal(calls.length,0)
    const form=walk(root).find(n=>n.tag==='form');walk(root).find(n=>n.name==='pais').value='br'
    await form.listeners.submit({preventDefault(){}});assert.equal(calls[0].args.p_pais,'BR');assert.equal(loaded,0)
    assert.match(text(root),/2 sem registro geográfico/)
    const button=walk(root).find(n=>n.textContent==='Carregar mapa Leaflet');button.listeners.click();await new Promise(r=>setImmediate(r))
    assert.equal(loaded,1);assert.equal(markers.length,1);assert.match(text(popups[0]),/<img onerror/)
    assert.equal(tiles.url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');assert.match(tiles.options.attribution,/OpenStreetMap/)
    await form.listeners.submit({preventDefault(){}});assert.equal(removed,1)
    view.destroy()
  }finally{globalThis.document=old}
})
