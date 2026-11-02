export function approximatePosition(coords) {
  if(!coords||typeof coords.latitude!=='number'||!Number.isFinite(coords.latitude)||Math.abs(coords.latitude)>90
    ||typeof coords.longitude!=='number'||!Number.isFinite(coords.longitude)||Math.abs(coords.longitude)>180
    ||typeof coords.accuracy!=='number'||!Number.isFinite(coords.accuracy)||coords.accuracy<0||coords.accuracy>20000)return null
  return {latitude:Math.round(coords.latitude*100)/100,longitude:Math.round(coords.longitude*100)/100,consentimento:'geo-navegador-v1'}
}

// Um pedido ao inicializar a página, sempre sujeito à permissão do navegador.
export function createGeoCollection({send,geolocation,status}) {
  let session=null,position=null,queue=Promise.resolve(),request=0,busy=false
  const enqueue=()=>{
    const id=session,location=position
    if(!id)return Promise.resolve()
    queue=queue.catch(()=>{}).then(()=>send({sessao:id,...(location?{localizacao:location}:{})}))
    return queue
  }
  const show=text=>{if(status)status.textContent=text}
  const locate=()=>{
      if(!geolocation||busy)return
      const current=++request;busy=true
      show('Aguardando sua permissão. Se recusar ou houver falha, permanece a estimativa por IP.')
      const fallback=()=>{
        if(current!==request)return
        busy=false;position=null
        show('Localização não fornecida ou imprecisa. Mantida a alternativa por IP, quando disponível.')
        void enqueue().catch(()=>{})
      }
      try{geolocation.getCurrentPosition(async result=>{
        if(current!==request)return
        const approximate=approximatePosition(result.coords)
        if(!approximate){fallback();return}
        position=approximate
        try{
          await enqueue()
          if(current===request)show('Localização aproximada autorizada enviada. O município poderá ser estimado com a base local IBGE; não acompanhamos deslocamentos.')
        }catch{
          if(current===request){position=null;show('Não foi possível enviar a localização. Mantida a alternativa por IP.');void enqueue().catch(()=>{})}
        }finally{if(current===request)busy=false}
      },fallback,{enableHighAccuracy:false,timeout:8000,maximumAge:60000})}catch{fallback()}
  }
  locate()
  return {visit(id){session=id;return enqueue().catch(()=>{
    if(position){position=null;show('Não foi possível enviar a localização. Mantida a alternativa por IP.');return enqueue().catch(()=>{})}
  })}}
}
