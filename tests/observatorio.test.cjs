const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/js/observatorio-model.js');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/observatorio-conteudos.json'), 'utf8'));
test('preserva os oito conteúdos existentes e seleciona cinco destaques', () => {
  assert.equal(data.itens.length, 8);
  const selected = model.highlights(data.itens);
  assert.equal(selected.length, 5);
  assert.ok(selected.every(item => item.destaque));
});
test('busca não diferencia maiúsculas nem acentos e inclui fonte, projeto e tags', () => {
  const item = { titulo: 'Adoção responsável', fonte: 'FCT/UNESP', projeto: 'pet.IA', tags: ['regulação'] };
  for (const query of ['ADOCAO', 'unesp', 'PET.ia', 'regulacao']) assert.ok(model.matches(item, { query }));
  assert.equal(model.matches(item, { query: 'inexistente' }), false);
});
test('filtros de área, tipo e busca são combinados', () => {
  const item = data.itens.find(item => item.id === 'pescar-ia-ciencia-cidada');
  assert.ok(model.matches(item, { area: 'Dados', type: 'Notícias', query: 'pescar' }));
  assert.ok(model.matches(item, { area: 'Aplicações' }));
  assert.equal(model.matches(item, { area: 'Regulação' }), false);
  assert.equal(model.matches(item, { area: 'Dados', type: 'Análise' }), false);
});
test('notícias incluem matérias de TV e jornais da coleção de mídia', () => {
  const item = { tipo: 'TV', colecao: 'unesp.IA na mídia', titulo: 'Curso para a melhor idade' };
  assert.ok(model.matches(item, { type: 'Notícias' }));
  assert.ok(model.matches(item, { type: 'Mídia' }));
  assert.equal(model.matches(item, { type: 'Notícia monitorada' }), false);
});
test('classifica as publicações do painel sem exigir novos campos no banco', () => {
  for (const [tipo,area] of [['Indicador','Dados'],['Artigo científico','Pesquisas'],['Tese ou dissertação','Pesquisas'],['Política ou regulação','Regulação'],['Análise','Relatórios'],['Tecnologia','Aplicações']]) {
    assert.ok(model.areasFor({tipo}).includes(area));
  }
  assert.ok(model.areasFor({ categoria: 'Benchmarks' }).includes('Avaliações'));
});
test('conteúdo remoto preserva capa, destaque e revisão, normalizando palavras-chave', () => {
  const item = model.fromDatabase({id:4,tipo:'TV',colecao:'unesp.IA na mídia',titulo:'Entrevista',imagem_url:'https://example.org/capa.png',destaque:true,palavras_chave:'IA, educação, ',veiculo:'TV',fonte:'Redação'});
  assert.equal(item.imagem,'https://example.org/capa.png');
  assert.equal(item.destaque,true);
  assert.deepEqual(item.tags,['IA','educação']);
  assert.equal(item.fonte,'TV • Redação');
  assert.equal(item.revisao,'Revisão humana concluída');
});
test('mescla e ordena as fontes sem duplicar IDs e prioriza destaques', () => {
  const items = model.merge([{id:'a',titulo:'Antigo',data:'2026-01-01'}],[{id:'a',titulo:'Atualizado',data:'2026-09-30'},{id:'b',titulo:'Destaque',data:'2025-01-01',destaque:true}]);
  assert.equal(items.length,2);
  assert.equal(items[0].titulo,'Atualizado');
  assert.equal(model.highlights(items,1)[0].id,'b');
});
test('URLs externas e locais são permitidas, protocolos executáveis não', () => {
  const base='https://ronaldocmc.github.io/unesp.ia/observatorio.html';
  assert.equal(model.safeURL('pesquisa.html',base),'https://ronaldocmc.github.io/unesp.ia/pesquisa.html');
  assert.equal(model.safeURL('https://example.org/artigo',base),'https://example.org/artigo');
  for (const bad of ['javascript:alert(1)','data:text/html,test','file:///secret',null,'']) assert.equal(model.safeURL(bad,base),null);
});
test('âncoras, assets e símbolos SVG usados pelo HTML existem', () => {
  const html=fs.readFileSync(path.join(root,'observatorio.html'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size,'IDs duplicados');
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]),'Âncora ausente: '+match[1]);
  for (const match of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
    const [file,fragment]=match[1].split('#');
    const local=file.split('?')[0];
    assert.ok(fs.existsSync(path.join(root,local)),local);
    if (fragment) assert.ok(fs.readFileSync(path.join(root,local),'utf8').includes('id="'+fragment+'"'),fragment);
  }
  assert.ok(!html.includes('Observar para alimentar os quatro eixos'));
  assert.ok(!html.includes('observatory-pipeline'));
  assert.ok(html.includes('Em desenvolvimento'));
});
