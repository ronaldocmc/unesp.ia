import { readFile, writeFile } from 'node:fs/promises'
import { CATALOGO_FEEDS } from '../supabase/functions/observatorio-radar/core.mjs'

const root = new URL('../supabase/functions/observatorio-radar/', import.meta.url)
const sections = []
for (const file of ['core.mjs', 'gemini.mjs', 'handler.mjs', 'index.ts']) {
  const source = await readFile(new URL(file, root), 'utf8')
  sections.push(source.replace(/^import .* from '\.\/[^']+'\r?\n/gm, '').replace(/^export /gm, ''))
}
await writeFile(new URL('index.web.ts', root), '// Versão arquivo único para colar no Supabase Web como index.ts da função observatorio-radar.\n// Gerado por scripts/bundle_observatorio_radar.mjs.\n' + sections.join('\n'))
await writeFile(new URL('../../../assets/data/radar-fontes.json', root), JSON.stringify(CATALOGO_FEEDS, null, 2) + '\n')
console.log('Gerado: supabase/functions/observatorio-radar/index.web.ts')
