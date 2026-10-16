import { RadarError } from './core.mjs'

export function radarLinkKey(value) {
  return String(value || '').split('#')[0].trim().toLowerCase()
}

export async function carregarDescartes(db) {
  const keys = new Set()
  for (let offset = 0;; offset += 1000) {
    const { data, error } = await db.from('observatorio_radar_descartes').select('url_key').eq('ativo', true).range(offset, offset + 999)
    if (error) throw new RadarError('Não foi possível conferir descartes. Execute a migration radar_curadoria antes de coletar.', 503)
    for (const row of data || []) keys.add(row.url_key)
    if ((data || []).length < 1000) return keys
  }
}
