import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const files = ['assets/js/observatorio-conversa-model.js', 'supabase/functions/observatorio-conversa/handler.mjs', 'supabase/functions/observatorio-conversa/index.ts']
const sections = await Promise.all(files.map(async file => (await readFile(new URL(file, root), 'utf8')).replace(/^import .* from '\.{1,2}\/[^']+'\r?\n/gm, '').replace(/^export /gm, '')))
// Os módulos compartilhados são JavaScript, não TypeScript. O arquivo único
// mantém a mesma sintaxe executável; seus módulos são cobertos pelos testes.
await writeFile(new URL('supabase/functions/observatorio-conversa/index.web.ts', root), '// @ts-nocheck\n// Gerado a partir de módulos JavaScript por scripts/bundle_observatorio_conversa.mjs.\n// Cole como index.ts da função observatorio-conversa.\n' + sections.join('\n'))
console.log('Gerada função observatorio-conversa em arquivo único.')
