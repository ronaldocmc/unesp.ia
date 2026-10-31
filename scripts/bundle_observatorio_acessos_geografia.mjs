import {readFile,writeFile} from 'node:fs/promises'
const root=new URL('../supabase/functions/observatorio-acessos-geografia/',import.meta.url)
const core=await readFile(new URL('core.mjs',root),'utf8')
const entry=await readFile(new URL('index.ts',root),'utf8')
const output='// GERADO por scripts/bundle_observatorio_acessos_geografia.mjs. Cole tudo como index.ts.\n'
  +core.replace(/^export /gm,'')+'\n'+entry.replace(/^import \{ createGeoHandler \}[^\n]*\n/m,'')
await writeFile(new URL('index.web.ts',root),output)
console.log('Gerado observatorio-acessos-geografia/index.web.ts')
