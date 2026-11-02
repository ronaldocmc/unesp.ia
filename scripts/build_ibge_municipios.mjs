// Atualização explícita da base; nunca executado durante uma visita.
import {writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const geometryURL='https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio&periodo=2022'
const namesURL='https://servicodados.ibge.gov.br/api/v1/localidades/municipios'
async function download(url){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`IBGE HTTP ${r.status}`);return r.text()}
const [geometryText,namesText]=await Promise.all([download(geometryURL),download(namesURL)])
const geometry=JSON.parse(geometryText),names=new Map(JSON.parse(namesText).map(x=>[String(x.id),x]))
const records=geometry.features.map(f=>{
  const code=String(f.properties.codarea),name=names.get(code),state=name?.microrregiao?.mesorregiao?.UF||name?.['regiao-imediata']?.['regiao-intermediaria']?.UF
  if(!name||!state||!['Polygon','MultiPolygon'].includes(f.geometry.type))throw Error(`Município inválido: ${code}`)
  const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates
  const points=polygons.flat(2),bbox=[Infinity,Infinity,-Infinity,-Infinity]
  for(const [x,y] of points){if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Coordenada inválida');bbox[0]=Math.min(bbox[0],x);bbox[1]=Math.min(bbox[1],y);bbox[2]=Math.max(bbox[2],x);bbox[3]=Math.max(bbox[3],y)}
  return [code,name.nome,state.nome,bbox,polygons]
}).sort((a,b)=>a[0].localeCompare(b[0]))
if(records.length!==5570||new Set(records.map(r=>r[0])).size!==5570)throw Error('Edição 2022 inesperada')
const root=new URL('../supabase/functions/observatorio-acessos-geografia/',import.meta.url)
await writeFile(new URL('ibge-data.mjs',root),'// Gerado por scripts/build_ibge_municipios.mjs. Fonte: IBGE, malhas simplificadas 2022.\nexport const ibgeMunicipios='+JSON.stringify(records)+'\n')
await writeFile(new URL('ibge-proveniencia.json',root),JSON.stringify({fonte:'IBGE — API Malhas e Localidades',edicao:2022,qualidade:'minima (simplificada; não cadastral)',municipios:records.length,geometryURL,namesURL,obtido_em:new Date().toISOString(),sha256_malha:createHash('sha256').update(geometryText).digest('hex'),sha256_nomes:createHash('sha256').update(namesText).digest('hex'),documentacao:'https://servicodados.ibge.gov.br/api/docs/malhas?versao=3'},null,2)+'\n')
console.log(`Base IBGE gerada: ${records.length} municípios`)
