import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { evidenceURL, displayDate, mountTracking, workerStatus } from '../assets/js/portal/observatorio-acompanhamento.js'

test('acompanhamento: links seguros e datas em Brasília', () => {
  for (const url of ['javascript:alert(1)','data:text/html,foo','https://user:secret@example.org/','not a url']) assert.equal(evidenceURL(url), null)
  assert.equal(evidenceURL('https://example.org/noticia'), 'https://example.org/noticia')
  assert.equal(displayDate(null), 'Não informada'); assert.equal(displayDate('infinity'), 'Não informada')
  assert.match(displayDate('2026-10-25T03:30:00Z'), /25\/10\/2026.*00:30/)
})

test('monitor não confunde execução, reserva e falta de sinal com conversão', () => {
  assert.match(workerStatus({em_processamento:1}),/reservado/)
  assert.match(workerStatus({}),/Nenhuma execução/)
  assert.match(workerStatus({ultima_execucao:'2026-10-25T03:00:00Z',consultado_em:'2026-10-25T03:02:00Z'}),/recente/)
  assert.match(workerStatus({ultima_execucao:'2026-10-25T03:00:00Z',consultado_em:'2026-10-25T03:10:00Z'}),/Sem sinal recente/)
})

test('acompanhamento: filtros, paginação, editor existente e restauração da administração', async () => {
  const oldDocument = globalThis.document
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.hidden = false; this.value = ''; this.textContent = ''; this.classList = { add() {}, remove() {} } }
    append(...nodes) { this.children.push(...nodes); if (this.tag === 'select' && this.children.length === nodes.length) this.value = nodes[0]?.value || '' }
    prepend(node) { this.children.unshift(node) }
    replaceChildren(...nodes) { this.children = []; this.value = ''; this.append(...nodes) }
    addEventListener(event, fn) { this.listeners[event] = fn }
    setAttribute() {} focus() { this.focused = true }
    set innerHTML(_) { throw new Error('Não inserir HTML recebido do banco') }
    reset() { walk(this).forEach(n => { if (n.tag === 'input') n.value = ''; if (n.tag === 'select') n.value = n.children[0]?.value || '' }) }
  }
  const walk = root => [root,...root.children.flatMap(walk)]
  const text = root => [root.textContent,...root.children.map(text)].join(' ')
  const flush = () => new Promise(resolve => setImmediate(resolve))
  try {
    globalThis.document = { createElement: tag => new Node(tag), createTextNode: value => Object.assign(new Node('#text'),{textContent:value}), querySelectorAll: () => [] }
    const workspace = new Node('section'), regular = new Node('div'), hidden = new Node('div'), button = new Node('button')
    hidden.hidden = true; workspace.append(regular,hidden)
    const calls = [], reviews = []; let fail = false
    const result = { total:26,aguardando_validacao:26,contadores:{revisao:26},consultado_em:'2026-10-25T03:00:00Z',origens:[],itens:[{
      titulo:'<img src=x onerror=alert(1)>',situacao:'revisao',conteudo_id:7,tentativas:0,estado_link:'pendente',url_evidencia:'javascript:alert(1)'
    }] }
    const tracking = mountTracking({workspace,button,openReview:async id => reviews.push(id),db:{rpc:async (name,args) => {
      if (name === 'observatorio_worker_situacao') return {data:{execucoes_hoje:5,tentativas_hoje:2,resolvidos_hoje:1}}
      calls.push({name,args}); return fail ? {error:new Error('missing')} : {data:result}
    }}})
    button.listeners.click(); await flush()
    assert.equal(regular.hidden,true); assert.equal(hidden.hidden,true)
    assert.equal(calls[0].name,'observatorio_acompanhamento')
    assert.equal(calls[0].args.p_tamanho,25)
    const panel = workspace.children[0]
    assert.match(text(panel), /26 aguardando validação/)
    assert.match(text(panel), /Execuções hoje: 5/)
    assert.match(text(panel), /Resoluções confirmadas hoje: 1/)
    assert.match(text(panel), /<img src=x onerror=alert\(1\)>/)
    assert.ok(!walk(panel).some(n => n.tag === 'a' && String(n.href).startsWith('javascript:')))
    const review = walk(panel).find(n => n.textContent === 'Abrir para revisão'); await review.listeners.click(); assert.deepEqual(reviews,[7])
    const next = walk(panel).find(n => n.textContent === 'Próxima'); next.listeners.click(); await flush(); assert.equal(calls.at(-1).args.p_pagina,2)
    const form = walk(panel).find(n => n.tag === 'form'), input = walk(panel).find(n => n.name === 'veiculo')
    input.value = 'Veículo'; form.listeners.submit({preventDefault(){}}); await flush()
    assert.equal(calls.at(-1).args.p_pagina,1); assert.equal(calls.at(-1).args.p_filtros.veiculo,'Veículo')
    fail = true; form.listeners.submit({preventDefault(){}}); await flush(); assert.match(text(panel), /migration observatorio_acompanhamento/)
    tracking.hide(); assert.equal(regular.hidden,false); assert.equal(hidden.hidden,true); assert.equal(panel.hidden,true)
  } finally { globalThis.document = oldDocument }
})

test('PostgreSQL: acompanhamento separa filas, pagina e protege dados privados', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema private;
      create function private.is_observatorio_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='yes' $$;
      create function private.radar_google_chave(url text) returns text language sql immutable as $$ select split_part(replace(url,'/rss/articles/','/articles/'),'?',1) $$;
      create table public.observatorio_conteudos(id bigint primary key,titulo text,veiculo text,fonte text,categoria text,origem text,
        status text,revisao_humana boolean,aprovado_curadoria boolean,url text,url_rss text,url_original text,url_resolucao_status text,
        url_resolucao_metodo text,created_at timestamptz default '2026-10-25T03:30:00Z',updated_at timestamptz default now(),data_publicacao date);
      create table private.radar_google_fila(google_key text primary key,contexto jsonb,estado text,proxima_em timestamptz,
        url_original text,metodo text,tentativas integer,ultimo_motivo text,criado_em timestamptz default now(),atualizado_em timestamptz default now(),token uuid);
      create table private.radar_url_origens(origem text,dia date,quantidade integer,proxima_em timestamptz,pausado_ate timestamptz,token text);
      create table public.observatorio_radar_descartes(url_key text,url text,titulo text,fonte text,motivo text,descartado_em timestamptz,ativo boolean);
      insert into public.observatorio_conteudos(id,titulo,fonte,categoria,origem,status,revisao_humana,aprovado_curadoria,url)
        select n,'Notícia '||n,'Veículo _100%','Pesquisa','Agente Radar','revisao',false,false,'https://example.org/'||n from generate_series(1,30) n;
      insert into public.observatorio_conteudos(id,titulo,status,revisao_humana,aprovado_curadoria,url) values
        (31,'Publicado manual','publicado',true,false,'https://example.org/31'),
        (32,'Arquivado','arquivado',false,false,'https://example.org/32'),
        (33,'Publicado sem revisão','publicado',false,false,'https://example.org/33'),
        (34,'Sem link','rascunho',false,false,null),
        (35,'Google associado','revisao',false,false,'https://news.google.com/rss/articles/AAA'),
        (36,'Outro cadastro Google','revisao',false,false,'https://news.google.com/articles/AAA');
      insert into private.radar_google_fila values
        ('https://news.google.com/articles/AAA','{"titulo":"Notícia da fila","feed_codigo":"feed_a","veiculo":"Veículo"}','pendente',now()+interval '1 hour',null,null,2,'HTTP 429',now(),now(),'12345678-1234-4234-8234-123456789abc'),
        ('https://news.google.com/articles/BBB','{}','resolvido',now(),'https://example.org/original','cache',1,null,now(),now(),null),
        ('https://news.google.com/articles/CCC','{}','falhou',now(),null,null,5,'Sem título',now(),now(),null);
      insert into private.radar_url_origens values('https://news.google.com',current_date,10,now(),now()+interval '1 hour','SEGREDO');
      insert into public.observatorio_radar_descartes values('d1','https://example.org/descarte','Descartado','Veículo','Fora do tema',now(),true),('d2','','Inativo','','',now(),false);`)
    const sql = readFileSync(new URL('../supabase/migrations/202610250001_observatorio_acompanhamento.sql', import.meta.url), 'utf8')
    await db.exec(sql); await db.exec(sql)
    const rpc = async (mode = 'editorial', filters = {}, page = 1, size = 25) => (await db.query('select public.observatorio_acompanhamento($1,$2,$3,$4) as r', [mode,JSON.stringify(filters),page,size])).rows[0].r
    await db.exec('set role anon')
    await assert.rejects(rpc(), /permission denied/)
    await db.exec('reset role; set role authenticated')
    await assert.rejects(rpc(), /Acesso restrito/)
    await assert.rejects(db.query('select * from private.observatorio_acompanhamento_base'), /permission denied/)
    await db.exec("select set_config('test.admin','yes',false)")
    const all = await rpc()
    assert.equal(all.total, 36); assert.equal(all.itens.length, 25); assert.equal(all.aguardando_validacao, 34)
    assert.equal(all.contadores.publicado, 1); assert.equal(all.contadores.arquivado, 1)
    assert.equal((await rpc('editorial',{},2)).itens.length, 11)
    const page2 = await rpc('editorial',{},2)
    assert.equal(new Set([...all.itens,...page2.itens].map(row => row.chave)).size, 36)
    assert.equal((await rpc('editorial',{ situacao:'publicado' })).itens[0].titulo, 'Publicado manual')
    assert.equal((await rpc('editorial',{ inicio:'2026-10-25',fim:'2026-10-25',fonte:'_100%' })).total, 30)
    assert.equal((await rpc('editorial',{ inicio:'2026-10-24',fim:'2026-10-24' })).total, 0)
    assert.equal((await rpc('editorial',{ revisao:'false',categoria:'Pesquisa' })).total, 30)
    assert.equal((await rpc('editorial',{ evidencia:'google_rss' })).total, 2)
    assert.equal((await rpc('editorial',{ evidencia:'ausente' })).total, 1)
    const tech = await rpc('tecnica')
    assert.equal(tech.total, 3); assert.equal(tech.contadores.agendado, 1)
    assert.equal(tech.itens.filter(row => row.chave.endsWith('AAA')).length, 1)
    assert.equal(tech.itens.find(row => row.chave.endsWith('BBB')).conteudo_id, null)
    assert.equal((await rpc('tecnica',{feed:'feed_a'})).total, 1)
    assert.equal((await rpc('tecnica',{feed:'nao_informado'})).total, 2)
    assert.equal((await rpc('tecnica',{busca:'429'})).total, 1)
    assert.ok(!JSON.stringify(tech).includes('SEGREDO')); assert.ok(!JSON.stringify(tech).includes('12345678'))
    assert.ok(tech.itens.every(row => !Object.hasOwn(row,'contexto') && !Object.hasOwn(row,'token')))
    assert.equal((await rpc('descartes')).total, 1)
    for (const args of [['errado',{}],['editorial',{},0],['editorial',{},1,101],['editorial',{inicio:'2026-10-26',fim:'2026-10-25'}]]) await assert.rejects(rpc(...args), /inválid/)
    await db.exec("select set_config('test.admin','',false)")
    await assert.rejects(rpc(), /Acesso restrito/)
    await db.exec('reset role')
    assert.equal((await db.query('select count(*)::int as n from private.radar_google_fila')).rows[0].n,3)
    assert.equal((await db.query("select count(*)::int as n from public.observatorio_conteudos where status='revisao'")).rows[0].n,32)
  } finally { await db.close() }
})
