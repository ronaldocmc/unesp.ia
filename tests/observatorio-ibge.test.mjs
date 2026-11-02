import test from 'node:test'
import assert from 'node:assert/strict'
import {municipalityAt} from '../supabase/functions/observatorio-acessos-geografia/ibge.mjs'
import {ibgeMunicipios} from '../supabase/functions/observatorio-acessos-geografia/ibge-data.mjs'
const square=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d],[a,b]]
const record=polygons=>['1234567','Teste','UF',[0,0,10,10],polygons]
test('IBGE: base completa e ponto arredondado em Pirapozinho',()=>{
 assert.equal(ibgeMunicipios.length,5570)
 assert.equal(new Set(ibgeMunicipios.map(r=>r[0])).size,5570)
 assert.deepEqual(municipalityAt(-22.28,-51.5),{pais:'BR',regiao:'São Paulo',cidade:'Pirapozinho',codigo_ibge:'3539202',base_geografica:'IBGE-malhas-2022-simplificada'})
 for(const p of [[0,0],[51.5,-.12],[NaN,0],[91,0]])assert.equal(municipalityAt(...p),null)
})
test('IBGE: polígonos, buracos, multipolígonos e células na divisa',()=>{
 const one=[record([[square(0,0,10,10),square(4,4,6,6)]])]
 assert.equal(municipalityAt(2,2,one).cidade,'Teste')
 assert.equal(municipalityAt(5,5,one),null)
 assert.equal(municipalityAt(2,0,one),null)
 assert.equal(municipalityAt(4,5,one),null)
 // Buraco inteiramente dentro da célula: os quatro cantos não o detectariam.
 assert.equal(municipalityAt(2,2,[record([[square(0,0,10,10),square(2.001,2.001,2.003,2.003)]])]),null)
 const multi=[record([[square(0,0,3,3)],[square(7,7,10,10)]])]
 assert.equal(municipalityAt(8,8,multi).cidade,'Teste')
 assert.equal(municipalityAt(5,5,multi),null)
 assert.equal(municipalityAt(2,2,[...one,...one]),null)
})
