const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('home contém as seções da proposta e mantém as âncoras antigas', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of ['top','ecossistema','projetos','eixos','aprender','experimentar','pesquisa','inovacao','inovacao-iniciativas','aplicar','agentes','conteudos','sobre']) assert.ok(ids.includes(id),id);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]),match[1]);
  assert.equal((html.match(/class="lab-axis lab-/g)||[]).length,6);
  assert.equal((html.match(/class="lab-level lab-/g)||[]).length,6);
  assert.equal((html.match(/<main\b/g)||[]).length,1);
});

test('assets, ícones e destinos locais da home existem', () => {
  for (const match of html.matchAll(/(?:src|href|action)="([^"#][^"]*)"/g)) {
    if (/^https?:/.test(match[1])) continue;
    const [file,fragment] = match[1].split('#');
    const local = file.split('?')[0];
    assert.ok(fs.existsSync(path.join(root,local)),local);
    if (fragment && local.endsWith('.svg')) assert.ok(fs.readFileSync(path.join(root,local),'utf8').includes('id="'+fragment+'"'),fragment);
  }
});

test('reutiliza a referência fornecida, sem substituir a home por uma imagem', () => {
  const png=fs.readFileSync(path.join(root,'assets/img/ecossistema/referencia-home-lab.png'));
  assert.equal(png.readUInt32BE(16),1024);
  assert.equal(png.readUInt32BE(20),1536);
  assert.ok(html.includes('<h1 id="lab-title">'));
  assert.ok(html.includes('data-layout="compact"'));
  assert.ok(html.includes('name="busca"'));
  assert.ok(html.includes('Em desenvolvimento'));
  assert.ok(html.includes('administracao.html'));
});
