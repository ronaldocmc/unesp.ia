import { RadarError, selectCatalog } from './core.mjs'

export async function carregarFeeds(db, requested, contexto = 'manual') {
  if (!['manual', 'automatica'].includes(contexto)) throw new RadarError('Contexto de busca inválido.', 400)
  const { data, error } = await db.from('observatorio_feeds').select('*').eq('ativo', true).order('prioridade').order('nome')
  if (error) throw new RadarError('Não foi possível carregar observatorio_feeds. Execute a migration de feeds e confira as permissões.', 503)
  if ((data || []).some(row => typeof row.busca_manual !== 'boolean' || typeof row.busca_automatica !== 'boolean')) {
    throw new RadarError('Execute a migration radar_fontes_uso para configurar fontes manuais e automáticas.', 503)
  }
  const catalog = (data || []).filter(row => row.ativo === true && row[`busca_${contexto}`] === true)
    .sort((a, b) => a.prioridade - b.prioridade || a.nome.localeCompare(b.nome))
    .map(row => ({ ...row, url: row.url_feed, origem: row.nome }))
  const { count, error: countError } = await db.from('observatorio_feeds').select('id', { count: 'exact', head: true })
  if (countError) throw new RadarError('Não foi possível consultar o catálogo de feeds.', 503)
  return { feeds: selectCatalog(catalog, requested), ativos: catalog.length, catalogados: count }
}
