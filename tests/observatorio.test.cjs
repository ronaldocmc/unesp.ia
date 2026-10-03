const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/js/observatorio-model.js');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/observatorio-conteudos.json'), 'utf8'));
test('exibe todos os oito conteúdos, com os destaques primeiro e sem duplicação', () => {
  assert.equal(data.itens.length, 8);
  const selected = model.orderedContents(data.itens);
  assert.equal(selected.length, data.itens.length);
  assert.equal(new Set(selected.map(item => item.id)).size, data.itens.length);
  const count = data.itens.filter(item => item.destaque).length;
  assert.ok(selected.slice(0, count).every(item => item.destaque));
  assert.ok(selected.slice(count).every(item => !item.destaque));
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
  assert.equal(model.orderedContents(items)[0].id,'b');
});
test('mantém a ordem cronológica dentro de cada grupo editorial sem alterar o original', () => {
  const items = [
    {id:'a',data:'2026-09-01'}, {id:'b',data:'2026-08-01',destaque:true},
    {id:'c',data:'2026-10-01'}, {id:'d',data:'2026-09-01',destaque:true}
  ];
  assert.deepEqual(model.orderedContents(items).map(item=>item.id),['d','b','c','a']);
  assert.deepEqual(items.map(item=>item.id),['a','b','c','d']);
});
test('segue a estrutura acordada e não repete destaques nem o cartão de dados', () => {
  const html = fs.readFileSync(path.join(root,'observatorio.html'),'utf8');
  const sections = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(sections,['conteudo','areas','analises','agentes','sobre']);
  assert.equal((html.match(/id="observatory-grid"/g)||[]).length,1);
  assert.ok(!html.includes('id="observatory-highlights"'));
  assert.ok(!html.includes('<details'));
  assert.ok(!html.includes('>Dados e Indicadores</h2>'));
  assert.ok(html.includes('Explore o <span>Observatório</span>'));
  assert.ok(html.includes('Acompanhe novidades, pesquisas, dados e análises sobre Inteligência Artificial.'));
  assert.ok(html.includes('Explorar análises e sínteses'));
});
test('cabeçalho do Observatório preserva a marca institucional completa', () => {
  const html = fs.readFileSync(path.join(root,'observatorio.html'),'utf8');
  const brandImage = /<img\b[^>]*class="brand-logo"[^>]*>/;
  assert.equal(html.match(brandImage)?.[0],'<img class="brand-logo" src="assets/img/logo-unesp-ia-research-innovation-lab.png" alt="unesp.IA Research &amp; Innovation Lab" width="2172" height="724">');
  assert.ok(!html.includes('observatory-brand-mark'),'O logo não deve usar o contêiner de recorte');
});

test('apresentação institucional identifica a FCT/UNESP e mantém as estruturas futuras no condicional', () => {
  const html = fs.readFileSync(path.join(root,'observatorio.html'),'utf8');
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(html, /<title>Observar\.IA — Observatório de Inteligência Artificial da FCT\/UNESP<\/title>/);
  assert.match(text, /Faculdade de Ciências e Tecnologia da UNESP \(FCT\/UNESP\), Câmpus de Presidente Prudente/);
  assert.match(text, /Prof\. Ronaldo Celso Messias Correia/);
  assert.match(text, /Engenharia de Dados, Ciência de Dados e Inteligência Artificial/);
  assert.match(text, /Com a futura criação do Núcleo de Inteligência Artificial do Departamento de Matemática e Computação da FCT\/UNESP/);
  assert.match(text, /poderá integrar sua estrutura/);
  assert.match(text, /futuro I3A — Instituto de Inteligência Artificial Aplicada da UNESP/);
  assert.match(text, /dados produzidos por iniciativas, projetos e pesquisas da UNESP/);
  assert.match(text, /é uma iniciativa do Departamento de Matemática e Computação \(DMC\)/);
  assert.match(text, /fontes nacionais e internacionais com pesquisas, projetos e iniciativas da UNESP/);
  assert.doesNotMatch(text, /Claro, fica mais preciso|Essa formulação deixa/);
});

test('cartões agrupam capa, título e descrição no mesmo link seguro', () => {
  const js=fs.readFileSync(path.join(root,'assets/js/observatorio.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/observatorio.css'),'utf8');
  assert.ok(js.includes("const content = linkTo(item, 'obs-story-content')"));
  assert.ok(js.includes('content.append(cover)'));
  assert.ok(js.includes("content.append(title, element('p', 'obs-story-summary', item.resumo || ''))"));
  assert.ok(js.includes('article.append(content)'));
  assert.ok(!js.includes('title.append(linkTo('), 'Não deve haver links aninhados');
  assert.match(css,/\.obs-story-cover\s*\{[^}]*aspect-ratio: 3 \/ 2/);
  assert.match(css,/\.obs-story-cover img\s*\{[^}]*object-fit: contain/);
});

test('Sobre tem acesso na abertura e no menu, com parágrafos sem excesso de negrito', () => {
  const html = fs.readFileSync(path.join(root,'observatorio.html'),'utf8');
  const hero = html.split('<section class="obs-hero')[1].split('</section>')[0];
  const about = html.split('id="sobre"')[1].split('</section>')[0];
  assert.match(html, /<a href="#sobre">Sobre<\/a>/);
  assert.match(hero, /class="obs-button obs-button-about" href="#sobre">Sobre/);
  assert.ok(hero.indexOf('Conhecer as análises') < hero.indexOf('obs-button-about'));
  assert.match(hero, /<strong>Departamento de Matemática e Computação \(DMC\)<\/strong>/);
  assert.doesNotMatch(about, /<strong>/);
  assert.equal((about.match(/class="obs-about-block"/g) || []).length, 5);
  for (const heading of ['Fontes de informação','O que acompanhamos','Nosso objetivo','Vínculo acadêmico','Perspectivas']) assert.ok(about.includes(`<h3>${heading}</h3>`));
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
