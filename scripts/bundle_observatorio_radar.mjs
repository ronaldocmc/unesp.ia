import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../supabase/functions/observatorio-radar/', import.meta.url)
const sections = []
// Mesmas primitivas de validação SSRF usadas pelo importador, sem copiar sua lógica.
const linkCore = await readFile(new URL('../observatorio-link/core.mjs', root), 'utf8')
const start = linkCore.indexOf('export class ImportError')
const end = linkCore.indexOf('const MAX_BYTES')
if (start < 0 || end <= start) throw new Error('Não foi possível incluir as validações de URL do importador.')
sections.push("import { isIP } from 'node:net'\n" + linkCore.slice(start, end).replace(/^export /gm, ''))
const dates = await readFile(new URL('../../../assets/js/portal/publication-date.js', root), 'utf8')
const metadataStart = linkCore.indexOf('const entities =')
const metadataEnd = linkCore.indexOf('const cors =', metadataStart)
if (metadataStart < 0 || metadataEnd <= metadataStart) throw new Error('Extrator de metadados não encontrado.')
// Isola nomes locais do extrator sem incluir node:https ou seu lookup incompatível.
sections.push('const extractRadarPageMetadata = (() => {\n' + dates.replace(/^export /gm, '') + '\n'
  + linkCore.slice(metadataStart, metadataEnd).replace(/^export /gm, '') + '\nreturn extractMetadata\n})()\n')
for (const file of ['core.mjs', 'relevance.mjs', 'feeds.mjs', 'feed-network.mjs', 'curadoria.mjs', 'gemini.mjs', 'groq.mjs', 'handler.mjs', 'index.ts']) {
  const source = await readFile(new URL(file, root), 'utf8')
  sections.push(source.replace(/^import .* from '\.{1,2}\/[^']+'\r?\n/gm, '').replace(/^export /gm, ''))
}
await writeFile(new URL('index.web.ts', root), '// Versão arquivo único para colar no Supabase Web como index.ts da função observatorio-radar.\n// Gerado por scripts/bundle_observatorio_radar.mjs.\n' + sections.join('\n'))
console.log('Gerado: supabase/functions/observatorio-radar/index.web.ts')
