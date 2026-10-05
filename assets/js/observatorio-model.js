/* Modelo compartilhado pelo portal e pelos testes; sem dependência do DOM. */
(function (root) {
  'use strict';
  const AREAS = ['Radar de Notícias', 'Dados', 'Pesquisas', 'Avaliações', 'Regulação', 'Aplicações', 'Relatórios'];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  function areasFor(item) {
    const explicit = (Array.isArray(item.areas) ? item.areas : [item.area]).filter(area => AREAS.includes(area));
    if (explicit.length) return explicit;
    const type = normalize(item.tipo);
    const context = normalize([item.categoria, ...(Array.isArray(item.tags) ? item.tags : [])].join(' '));
    const areas = [];
    if (/noticia|midia|jornal|portal|tv|radio|rede social|radar/.test(type + ' ' + context)) areas.push('Radar de Notícias');
    if (/indicador|dataset|dados/.test(type + ' ' + context)) areas.push('Dados');
    if (/pesquisa|artigo cientifico|tese|dissertacao/.test(type)) areas.push('Pesquisas');
    if (/avaliacao|benchmark/.test(type + ' ' + context)) areas.push('Avaliações');
    if (/regula|governanca|legislacao|politica publica/.test(type + ' ' + context)) areas.push('Regulação');
    if (/tecnologia/.test(type) || /aplicac|experimentar|casos de uso/.test(context)) areas.push('Aplicações');
    if (/analise|relatorio|nota tecnica/.test(type)) areas.push('Relatórios');
    return areas;
  }
  function typeMatches(item, type) {
    const media = item.colecao === 'unesp.IA na mídia';
    return type === 'Todos' || (type === 'Notícias' && (String(item.tipo).startsWith('Notícia') || media))
      || (type === 'Mídia' ? media : item.tipo === type);
  }
  function matches(item, { area = 'Todos', type = 'Todos', types = null, query = '' } = {}) {
    const selectedTypes = Array.isArray(types) ? types.filter(Boolean) : [];
    const matchesType = selectedTypes.length ? selectedTypes.some(selected => typeMatches(item, selected)) : typeMatches(item, type);
    const haystack = normalize([item.titulo, item.resumo, item.fonte, item.tipo, item.categoria, item.veiculo, item.projeto, ...(Array.isArray(item.tags) ? item.tags : [])].join(' '));
    return (area === 'Todos' || areasFor(item).includes(area)) && matchesType && haystack.includes(normalize(query).trim());
  }
  function merge(localItems, remoteItems) {
    const map = new Map();
    [...localItems, ...remoteItems].forEach(item => {
      if (item && typeof item.titulo === 'string' && item.titulo.trim()) map.set(item.id || item.href || item.titulo, item);
    });
    return [...map.values()].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  }
  function orderedContents(items) {
    return [...items].sort((a, b) => Number(b.destaque === true) - Number(a.destaque === true) || String(b.data || '').localeCompare(String(a.data || '')));
  }
  function safeURL(value, base) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, base);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  function fromDatabase(row) {
    return {
      id: 'supabase-' + row.id, colecao: row.colecao, tipo: row.tipo, categoria: row.categoria,
      titulo: row.titulo, resumo: row.resumo, data: row.data_publicacao,
      fonte: row.veiculo ? row.veiculo + ' • ' + (row.fonte || '') : row.fonte,
      veiculo: row.veiculo, projeto: row.projeto_relacionado, href: row.url,
      imagem: row.imagem_url, destaque: row.destaque === true,
      tags: String(row.palavras_chave || '').split(',').map(value => value.trim()).filter(Boolean),
      revisao: 'Revisão humana concluída'
    };
  }
  const api = { AREAS, normalize, areasFor, matches, merge, orderedContents, safeURL, fromDatabase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ObservatoryModel = api;
})(globalThis);
