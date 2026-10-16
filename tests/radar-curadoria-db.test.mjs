// Integração opcional: RADAR_PGLITE_MODULE aponta para dist/index.js do PGlite.
// Executa PostgreSQL em memória, nunca se conecta ao Supabase real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

test('PostgreSQL: migration, RLS, revisão, publicação, descartes e idempotência', { skip: !process.env.RADAR_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db = new PGlite()
  const sql = file => readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')
  const admin = '00000000-0000-0000-0000-000000000001'
  const curator = '00000000-0000-0000-0000-000000000002'
  const instructor = '00000000-0000-0000-0000-000000000003'
  const second = '00000000-0000-0000-0000-000000000004'
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private;
      create table auth.users(id uuid primary key, email text);
      create table public.papeis_usuario(user_id uuid, papel text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      create function private.is_observatorio_admin() returns boolean language sql stable security definer as $$
        select exists(select 1 from public.papeis_usuario where user_id = auth.uid() and papel in ('administrador','observatorio_admin')) $$;
      create function private.is_observatorio_curador() returns boolean language sql stable security definer as $$
        select exists(select 1 from public.papeis_usuario where user_id = auth.uid() and papel = 'observatorio_curador') $$;
      grant usage on schema auth, private to authenticated, anon, service_role;
      insert into auth.users(id) values ('${admin}'),('${curator}'),('${instructor}'),('${second}');
      insert into public.papeis_usuario values ('${admin}','observatorio_admin'),('${curator}','observatorio_curador'),('${instructor}','instrutor'),('${second}','observatorio_curador');
    `)
    await db.exec(sql('202609260001_observatorio.sql').split('create index')[0])
    await db.exec(`alter table public.observatorio_conteudos
      add column aprovado_curadoria boolean not null default false,
      add column agente_origem text, add column agente_processado_em timestamptz,
      add column observacao_colaborador text, add column submetido_por uuid, add column relevancia_ia integer;
      alter table public.observatorio_conteudos enable row level security;
      grant select, insert on public.observatorio_conteudos to service_role;
      grant usage, select on sequence public.observatorio_conteudos_id_seq to service_role;
    `)
    const migration = sql('202610160003_radar_curadoria.sql')
    await db.exec(migration)
    async function asUser(id, role = 'authenticated') {
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ''])
      await db.exec(`set role ${role}`)
    }
    const draft = { titulo: 'Estudo sobre IA', resumo: 'Resumo revisado.', data_publicacao: '2026-10-16',
      categoria: 'pesquisa', fonte: 'Universidade', url: 'https://news.example.org/revisao', agente_origem: 'radar' }
    async function decide(action, content = draft, confirmation = false) {
      const result = await db.query('select public.observatorio_radar_decidir($1,$2::jsonb,$3,$4) as decision', [action, JSON.stringify(content), confirmation, 'Teste'])
      return result.rows[0].decision
    }
    async function rows() { await db.exec('reset role'); return (await db.query('select * from public.observatorio_conteudos order by id')).rows }

    await asUser(null, 'anon')
    await assert.rejects(decide('revisao'), /permission denied/i)
    await asUser(instructor)
    await assert.rejects(decide('revisao'), /exclusiva da curadoria/i)
    await asUser(curator)
    await assert.rejects(decide('publicar'), /Confirme explicitamente/i)
    assert.equal((await rows()).length, 0)
    await asUser(curator)
    assert.equal((await decide('revisao', { ...draft, status: 'publicado', destaque: true, revisao_humana: true, aprovado_curadoria: true })).situacao, 'revisao')
    let stored = (await rows())[0]
    assert.equal(stored.status, 'revisao'); assert.equal(stored.revisao_humana, false)
    assert.equal(stored.aprovado_curadoria, false); assert.equal(stored.destaque, false)
    assert.equal(stored.submetido_por, curator); assert.equal(stored.curadoria_por, null)
    await asUser(second)
    assert.equal((await decide('publicar', { ...draft, titulo: 'Não sobrescrever' }, true)).situacao, 'ja_cadastrado')
    assert.equal((await rows())[0].titulo, draft.titulo)
    await asUser(curator)
    const published = { ...draft, url: 'https://news.example.org/publicado' }
    assert.equal((await decide('publicar', published, true)).situacao, 'publicado')
    stored = (await rows())[1]
    assert.equal(stored.status, 'publicado'); assert.equal(stored.revisao_humana, true)
    assert.equal(stored.aprovado_curadoria, true); assert.equal(stored.curadoria_por, curator)
    assert.ok(stored.curadoria_em)

    await asUser(curator)
    const discarded = { ...draft, url: 'https://news.example.org/descartado#topo' }
    assert.equal((await decide('descartar', discarded)).situacao, 'descartado')
    assert.equal((await rows()).length, 2)
    await asUser(curator)
    assert.equal((await db.query('select * from public.observatorio_radar_descartes')).rows[0].descartado_por, curator)
    await assert.rejects(decide('revisao', { ...discarded, url: 'https://news.example.org/descartado' }), /foi descartado/)
    await assert.rejects(db.query("update public.observatorio_radar_descartes set ativo = false returning ativo").then(result => {
      if (!result.rows.length) throw new Error('RLS impediu atualização')
    }))
    await assert.rejects(db.query("insert into public.observatorio_radar_descartes(url_key,url,titulo) values ('x','x','x')"), /permission denied/i)
    await asUser(null, 'service_role')
    const auto = await db.query(`insert into public.observatorio_conteudos
      (colecao,tipo,categoria,titulo,resumo,data_publicacao,url,fonte,agente_origem,status)
      values('Observatório','Pesquisa','pesquisa','Automático','Resumo','2026-10-16',$1,'Fonte','radar','revisao') returning id`, ['https://news.example.org/descartado'])
    assert.equal(auto.rows.length, 0)
    const duplicate = await db.query(`insert into public.observatorio_conteudos
      (colecao,tipo,categoria,titulo,resumo,data_publicacao,url,fonte,agente_origem,status)
      values('Observatório','Pesquisa','pesquisa','Automático','Resumo','2026-10-16',$1,'Fonte','radar','revisao') returning id`, [draft.url])
    assert.equal(duplicate.rows.length, 0)

    await asUser(admin)
    assert.equal((await db.query('update public.observatorio_radar_descartes set ativo = false returning ativo')).rows.length, 1)
    await asUser(curator)
    assert.equal((await decide('revisao', discarded)).situacao, 'revisao')
    for (const patch of [{ url: 'javascript:alert(1)' }, { url: 'http://example.org/x' }, { resumo: '' }, { data_publicacao: '2026-02-30' }]) {
      await assert.rejects(decide('publicar', { ...draft, url: 'https://news.example.org/invalido', ...patch }, true))
    }
    await db.exec('reset role')
    await db.exec(migration) // Reexecução não apaga registros nem decisões.
    assert.equal((await rows()).length, 3)
  } finally { await db.close() }
})
