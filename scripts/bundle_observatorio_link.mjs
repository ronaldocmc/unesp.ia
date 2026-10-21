// Gera a versão de arquivo único para colar no Supabase Web.
import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const dates = await readFile(new URL('assets/js/portal/publication-date.js', root), 'utf8')
const limits = await readFile(new URL('supabase/functions/observatorio-link/limits.mjs', root), 'utf8')
const core = await readFile(new URL('supabase/functions/observatorio-link/core.mjs', root), 'utf8')
const transport = await readFile(new URL('supabase/functions/observatorio-link/edge-transport.mjs', root), 'utf8')
const entry = await readFile(new URL('supabase/functions/observatorio-link/index.ts', root), 'utf8')
const output = '// GERADO por scripts/bundle_observatorio_link.mjs. Cole tudo como index.ts no Supabase Web.\n'
  + dates.replace(/^export /gm, '') + '\n'
  + limits.replace(/^export /gm, '') + '\n'
  + core.replace(/^import .* from '\.{1,2}\/[^']+'\r?\n/gm, '').replace(/^export /gm, '') + '\n'
  + transport.replace(/^import .* from '\.{1,2}\/[^']+'\r?\n/gm, '').replace(/^export /gm, '') + '\n'
  + entry.replace(/^import \{ createHandler, ImportError \}[^\n]*\n/m, '')
await writeFile(new URL('supabase/functions/observatorio-link/index.web.ts', root), output)
console.log('Gerado: supabase/functions/observatorio-link/index.web.ts')
