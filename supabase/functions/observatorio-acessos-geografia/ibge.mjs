import {ibgeMunicipios} from './ibge-data.mjs'
// A célula de arredondamento inteira precisa caber no município simplificado.
// Não afirma precisão do dispositivo ou presença física, nem corrige erro do GPS.
function ringContains(x,y,ring){
  let inside=false
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [a,b]=ring[i],[c,d]=ring[j]
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside
  }
  return inside
}
function segmentTouchesBox(a,b,box){
  let lo=0,hi=1
  for(let k=0;k<2;k++){
    const delta=b[k]-a[k]
    if(delta===0){if(a[k]<box[k]||a[k]>box[k+2])return false;continue}
    let t1=(box[k]-a[k])/delta,t2=(box[k+2]-a[k])/delta
    if(t1>t2)[t1,t2]=[t2,t1]
    lo=Math.max(lo,t1);hi=Math.min(hi,t2)
    if(lo>hi)return false
  }
  return true
}
export function municipalityAt(latitude,longitude,records=ibgeMunicipios){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null
  const y=Math.round(latitude*100)/100,x=Math.round(longitude*100)/100
  const box=[x-.005001,y-.005001,x+.005001,y+.005001],matches=[]
  for(const [code,city,state,bbox,polygons] of records){
    if(x<bbox[0]||y<bbox[1]||x>bbox[2]||y>bbox[3])continue
    const contains=polygons.some(rings=>ringContains(x,y,rings[0])&&!rings.slice(1).some(r=>ringContains(x,y,r)))
    if(!contains)continue
    // Inclui ilhas, enclaves e buracos: não basta testar os quatro cantos.
    const boundary=polygons.some(rings=>rings.some(ring=>ring.some((p,i)=>segmentTouchesBox(p,ring[(i+1)%ring.length],box))))
    if(boundary)return null
    matches.push({pais:'BR',regiao:state,cidade:city,codigo_ibge:code,base_geografica:'IBGE-malhas-2022-simplificada'})
  }
  return matches.length===1?matches[0]:null
}
