// Artefato de importação administrativa; sem dados de visitantes ou acesso à rede.
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {ibgeMunicipios} from '../supabase/functions/observatorio-acessos-geografia/ibge-data.mjs'
if(ibgeMunicipios.length!==5570)throw Error('Base IBGE incompleta')
const result=spawnSync(process.env.IBGE_PYTHON || 'python', [fileURLToPath(new URL('./repair_ibge_csv.py',import.meta.url))], {input:JSON.stringify(ibgeMunicipios),encoding:'utf8',maxBuffer:32*1024*1024})
if(result.error)throw result.error
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
if(result.status!==0)process.exit(result.status || 1)
