import { isIP } from 'node:net'
export function publicIP(value) {
  if(typeof value!=='string' || value.length>64 || isIP(value)===0)return null
  const ip=value.toLowerCase()
  if(isIP(ip)===4){
    const [a,b,c]=ip.split('.').map(Number)
    if(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)
      ||(a===192&&(b===0||b===168||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113))return null
  }else if(!/^[23][0-9a-f]{0,3}:/.test(ip)||ip.startsWith('2001:db8:')||ip.includes('.'))return null
  return ip
}
// Nunca escolhe automaticamente um header: o ingresso deve sobrescrevê-lo e ser validado na implantação.
export function requestIP(headers,env) {
  if(env.GEO_TRUSTED_INGRESS!=='true')return null
  const name=env.GEO_IP_HEADER
  if(!['x-real-ip','cf-connecting-ip','x-forwarded-for'].includes(name))return null
  const raw=headers.get(name) || ''
  if(name!=='x-forwarded-for')return publicIP(raw.trim())
  if(!/^\d$/.test(env.GEO_XFF_INDEX_FROM_RIGHT || ''))return null
  return publicIP(raw.split(',').map(s=>s.trim()).at(-1-Number(env.GEO_XFF_INDEX_FROM_RIGHT)))
}
export function normalizeGeo(data) {
  if(data?.success!==true || !/^[A-Z]{2}$/.test(data.country_code || ''))return {}
  const text=value=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,'').trim().slice(0,100):''
  const geo={pais:data.country_code,regiao:text(data.region),cidade:text(data.city)}
  if(typeof data.latitude==='number'&&Number.isFinite(data.latitude)&&Math.abs(data.latitude)<=90
    &&typeof data.longitude==='number'&&Number.isFinite(data.longitude)&&Math.abs(data.longitude)<=180){
    geo.latitude=Math.round(data.latitude*10)/10;geo.longitude=Math.round(data.longitude*10)/10
  }
  return geo
}
async function readProvider(response) {
  const reader=response.body?.getReader();if(!reader)return {}
  let size=0,text='';const decoder=new TextDecoder()
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength
    if(size>10000){await reader.cancel();throw new Error('Resposta grande')}
    text+=decoder.decode(value,{stream:true})
  }
  return JSON.parse(text+decoder.decode())
}
export function createGeoHandler({db,env={},fetchImpl=fetch}) {
  const origins=new Set((env.GEO_ALLOWED_ORIGINS || 'https://ia.fct.unesp.br,https://ronaldocmc.github.io').split(',').map(x=>x.trim()))
  return async req=>{
    const origin=req.headers.get('origin'),headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'null','Vary':'Origin','Cache-Control':'no-store',
      'Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}
    const reply=(status,body)=>new Response(body?JSON.stringify(body):null,{status,headers:{...headers,'Content-Type':'application/json'}})
    if(!origins.has(origin))return reply(403,{ok:false})
    if(req.method==='OPTIONS')return reply(204)
    if(req.method!=='POST')return reply(405,{ok:false})
    if(req.headers.get('dnt')==='1'||req.headers.get('sec-gpc')==='1')return reply(204)
    try {
      // Limite real mesmo para transferência chunked; sem registrar corpo, IP ou headers em logs.
      const reader=req.body?.getReader();if(!reader)return reply(400,{ok:false})
      let text='',size=0;const decoder=new TextDecoder()
      for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>200){await reader.cancel();return reply(413,{ok:false})}text+=decoder.decode(value,{stream:true})}
      const body=JSON.parse(text+decoder.decode())
      if(!body||Object.keys(body).some(k=>k!=='sessao')||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.sessao || ''))return reply(400,{ok:false})
      const ip=requestIP(req.headers,env),enabled=env.GEO_PROVIDER==='ipwhois'&&env.GEO_PROVIDER_ENABLED==='true'
      const reservation=await db.rpc('observatorio_acesso_geo_reservar',{p_sessao:body.sessao,p_consultar:!!ip&&enabled})
      if(reservation.error)return reply(503,{ok:false})
      if(!reservation.data?.reservado)return reply(200,{ok:true})
      const lease=reservation.data;let geo={},pause=0
      if(lease.consultar){
        try {
          const response=await fetchImpl(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region,city,latitude,longitude`,
            {signal:AbortSignal.timeout(2000),redirect:'error',headers:{Accept:'application/json'}})
          if(response.status===429){
            const retry=response.headers.get('retry-after') || '',seconds=/^\d+$/.test(retry)?Number(retry):(Date.parse(retry)-Date.now())/1000
            pause=Number.isFinite(seconds)&&seconds>0?Math.min(2147483647,Math.ceil(Math.max(900,seconds))):86400
          }else if(response.ok){
            geo=normalizeGeo(await readProvider(response))
          }else pause=60
        }catch{pause=60}
      }
      const {error}=await db.rpc('observatorio_acesso_geo_finalizar',{p_sessao:body.sessao,p_token:lease.token,p_dia:lease.dia,p_geo:geo,p_pausa_segundos:pause})
      return reply(error?503:200,{ok:!error})
    }catch{return reply(400,{ok:false})}
  }
}
