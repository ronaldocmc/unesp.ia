const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('cabeçalho mantém a identidade do Observatório e o menu dos eixos', () => {
  const observatory = fs.readFileSync(path.join(root, 'observatorio.html'), 'utf8');
  const logo = '<img class="brand-logo" src="assets/img/logo-unesp-ia-research-innovation-lab.png" alt="unesp.IA Research &amp; Innovation Lab" width="2172" height="724">';
  assert.ok(html.includes(logo));
  assert.ok(observatory.includes(logo));
  const nav = html.match(/<nav class="lab-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const links = [...nav.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(links, [['#ecossistema','Ecossistema'],['#aprender','Aprender.IA'],['#experimentar','Experimentar.IA'],['pesquisa.html','Pesquisar.IA'],['#inovacao-iniciativas','Inovar.IA'],['observatorio.html','Observar.IA'],['equipe-lab.html','Equipe']]);
  assert.ok(!html.includes('class="lab-access"'));
});

test('hero usa apenas a ilustração do novo anexo, com os textos da home preservados', () => {
  const png=fs.readFileSync(path.join(root,'assets/img/ecossistema/referencia-home-ecossistema.png'));
  assert.equal(png.readUInt32BE(16),941);
  assert.equal(png.readUInt32BE(20),1672);
  assert.match(html, /<figure class="lab-hero-art"><img src="assets\/img\/ecossistema\/referencia-home-ecossistema.png"/);
  assert.ok(html.includes('Computação, Dados e Inteligência Artificial</span></h1>'));
  assert.ok(html.includes('ecossistema de <strong>Computação, Dados e Inteligência Artificial</strong>'));
  assert.ok(html.includes('pesquisa, formação, experimentação e inovação'));
});

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

test('Projetos e Soluções pode ser administrado pelo banco com imagem de card', () => {
  const js=fs.readFileSync(path.join(root,'assets/js/ecossistema-eixos.js'),'utf8');
  const admin=fs.readFileSync(path.join(root,'assets/js/portal/admin.js'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/202610050001_ecossistema_iniciativas_home.sql'),'utf8');
  const storage=fs.readFileSync(path.join(root,'supabase/migrations/202610050002_ecossistema_storage_imagens.sql'),'utf8');
  assert.ok(html.includes('data-home-initiatives'));
  assert.ok(js.includes('eixo=eq.inovacao&destaque=eq.true&status=eq.publicado&revisao_humana=eq.true'));
  assert.ok(js.includes('initiatives.slice(0,5).map(initiativeCard)'));
  assert.ok(js.includes('item.imagem_url'));
  assert.ok(admin.includes("['imagem_url','Imagem do card','image-upload',false]"));
  assert.ok(admin.includes("const IMAGE_BUCKET = 'ecossistema-imagens'"));
  assert.ok(admin.includes('supabase.storage.from(IMAGE_BUCKET).upload'));
  assert.ok(admin.includes("['destaque','Destaque na home','checkbox',false,false]"));
  assert.ok(migration.includes('add column if not exists imagem_url text'));
  assert.ok(storage.includes("insert into storage.buckets"));
  assert.ok(storage.includes("'ecossistema-imagens'"));
  assert.ok(html.includes('unesp.IA Lab'));
  assert.ok(html.includes('Gênio do Prompt'));
  assert.ok(html.includes('Paranapanema.IA'));
  assert.ok(!html.includes('Outras iniciativas'));
  assert.ok(!html.includes('lab-more-icon'));
  for (const image of ['pescar-ia.png','pet-ia.png','paranapanema-ia.png']) {
    assert.ok(fs.existsSync(path.join(root,'assets/img/ecossistema/iniciativas',image)),image);
  }
  assert.ok(fs.existsSync(path.join(root,'assets/img/ecossistema/iniciativas/genio-do-prompt.svg')));
});
