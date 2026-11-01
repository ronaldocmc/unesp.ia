const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
export const geoMethodLabel=method=>({navegador:'Navegador autorizado (aproximado)',ip:'Estimativa por IP',nao_identificado:'Não identificado',legado:'Histórico — método não registrado'}[method]||'Método não registrado')
let leafletPromise
export function loadLeaflet() {
  if(globalThis.L?.map)return Promise.resolve(globalThis.L)
  if(leafletPromise)return leafletPromise
  leafletPromise=new Promise((resolve,reject)=>{
    const css=node('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='anonymous'
    const script=node('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin='anonymous'
    const fail=()=>{clearTimeout(timer);script.remove();css.remove();leafletPromise=null;reject(new Error('Leaflet indisponível'))}
    const timer=setTimeout(fail,10000)
    script.onload=()=>{clearTimeout(timer);if(globalThis.L?.map)resolve(globalThis.L);else fail()}
    script.onerror=css.onerror=fail
    document.head.append(css,script)
  })
  return leafletPromise
}
export function mapPlaces(rows) {
  return rows.filter(row=>(row.pais||row.metodo==='navegador') && typeof row.latitude==='number' && Number.isFinite(row.latitude)&&Math.abs(row.latitude)<=90
    &&typeof row.longitude==='number'&&Number.isFinite(row.longitude)&&Math.abs(row.longitude)<=180&&Number(row.quantidade)>0)
}
export function renderGeoMap(L,container,rows,{tileURL='https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}={}) {
  const map=L.map(container,{maxZoom:8,scrollWheelZoom:false}).setView([-15,-48],3)
  L.tileLayer(tileURL,{attribution,maxZoom:8}).addTo(map)
  const points=mapPlaces(rows)
  for(const row of points){
    const popup=node('div');popup.append(node('strong',[row.cidade,row.regiao,row.pais].filter(Boolean).join(' · ')||'Área aproximada — município não identificado'),node('p',`${row.quantidade} visita(s) · ${geoMethodLabel(row.metodo)} · não comprova presença física`))
    L.circleMarker([row.latitude,row.longitude],{radius:Math.min(30,5+Math.sqrt(Number(row.quantidade))*2),color:'#075b91',fillColor:'#24a1bc',fillOpacity:0.55,weight:1}).addTo(map).bindPopup(popup)
  }
  if(points.length)map.fitBounds(points.map(row=>[row.latitude,row.longitude]),{padding:[25,25],maxZoom:6})
  map.invalidateSize()
  return map
}
export function mountGeoReport(parent,db,{leaflet=loadLeaflet,mapOptions={}}={}) {
  const panel=node('section');panel.className='obs-geo-report'
  panel.append(node('h3','Mapa de origem aproximada dos acessos'),node('p','Dois métodos: navegador com autorização e coordenadas arredondadas, ou estimativa por IP. Nenhum comprova presença física. O navegador não identifica automaticamente o município: esses pontos aparecem sem país/cidade; deixe os filtros geográficos vazios para vê-los. Histórico anterior não tem método comprovado. Sem vínculo com contas.'))
  const form=node('form');form.className='portal-form';const fields={}
  for(const [name,label,type]of [['inicio','Início do período','date'],['fim','Fim do período','date'],['pais','País (código, ex.: BR)','text'],['regiao','Estado / região','text'],['cidade','Cidade aproximada','text']]){
    const input=node('input');input.type=type;input.name=name;input.maxLength=name==='pais'?2:100
    if(type==='date'){input.required=true;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());input.value=name==='inicio'?today.slice(0,7)+'-01':today}
    const wrapper=node('label',label);wrapper.append(input);form.append(wrapper);fields[name]=input
  }
  const submit=node('button','Consultar origens');submit.type='submit';submit.className='btn';form.append(submit)
  const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite')
  const output=node('div'),mapButton=node('button','Carregar mapa Leaflet');mapButton.type='button';mapButton.className='btn secondary';mapButton.hidden=true
  const consent=node('p','Carregar o mapa conecta seu navegador de administrador ao CDN do Leaflet e aos mapas OpenStreetMap. Isso envia seu IP a esses serviços; não enviamos nomes ou identificadores dos visitantes. A tabela funciona sem carregar o mapa.')
  const container=node('div');container.className='obs-geo-map';container.hidden=true;container.setAttribute('role','region');container.setAttribute('aria-label','Mapa de visitas por região aproximada')
  panel.append(form,status,output,consent,mapButton,container,node('p','Histórico anterior à ativação não pode ser localizado. Ausência de ponto pode significar cidade desconhecida, serviço indisponível ou cota. Os totais são sessões, não pessoas únicas. Até 1.000 localidades por consulta; refine os filtros se necessário.'))
  parent.append(panel);let map=null,rows=[],version=0
  async function showMap(){
    const current=version;mapButton.disabled=true
    try{const L=await leaflet();if(current!==version)return;container.hidden=false;map?.remove();map=renderGeoMap(L,container,rows,mapOptions);mapButton.hidden=true}
    catch{if(current===version)status.textContent+=' Mapa indisponível. A tabela continua disponível.'}
    finally{mapButton.disabled=false}
  }
  mapButton.addEventListener('click',()=>void showMap())
  form.addEventListener('submit',async event=>{
    event.preventDefault();const current=++version
    submit.disabled=true;map?.remove();map=null;container.hidden=true;mapButton.hidden=true;output.replaceChildren();status.textContent='Consultando origens…'
    try{
      const {data,error}=await db.rpc('observatorio_acessos_geografia',{p_inicio:fields.inicio.value,p_fim:fields.fim.value,
        p_pais:fields.pais.value.trim().toUpperCase(),p_regiao:fields.regiao.value.trim(),p_cidade:fields.cidade.value.trim()})
      if(current!==version)return
      if(error||!Array.isArray(data?.locais))throw new Error()
      rows=data.locais.map(row=>({...row,latitude:row.latitude==null?null:Number(row.latitude),longitude:row.longitude==null?null:Number(row.longitude)}))
      const semRegistro=Math.max(0,Number(data.visitas_periodo)-Number(data.geografia_registrada))
      status.textContent=`Período completo: ${data.visitas_periodo} visitas; ${data.localizadas} com localização aproximada; ${data.nao_identificadas} não identificadas; ${semRegistro} sem registro geográfico. Filtros: ${data.visitas_filtradas} visitas em ${data.total_locais} área(s)/método(s).`
      if(Number(data.total_locais)>1000)output.append(node('p','Exibindo as 1.000 localidades com mais visitas. Refine os filtros.'))
      const table=node('table');table.className='admin-table';const head=node('thead'),tr=node('tr'),body=node('tbody')
      for(const label of ['País','Estado / região','Cidade aproximada','Método de coleta','Visitas']){const th=node('th',label);th.scope='col';tr.append(th)}head.append(tr);table.append(head,body)
      for(const row of rows){const tr=node('tr');for(const value of [row.pais||'Não identificado',row.regiao||'Não informada',row.cidade||'Não informada',geoMethodLabel(row.metodo),row.quantidade])tr.append(node('td',String(value)));body.append(tr)}
      const wrap=node('div');wrap.className='table-wrap';wrap.append(table);output.append(wrap)
      if(!rows.length)output.append(node('p','Nenhum registro geográfico corresponde aos filtros.'))
      mapButton.hidden=mapPlaces(rows).length===0
    }catch{if(current===version)status.textContent='Geografia indisponível. Confira a migration de acessos geográficos; as estatísticas tradicionais continuam independentes.'}
    finally{if(current===version)submit.disabled=false}
  })
  return {destroy(){++version;map?.remove();panel.remove()}}
}
