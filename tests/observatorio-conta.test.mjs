import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {signupInput,safeAccountReturn,saveAccount,CONSENT_VERSION,suggestionLabel,googleAvailable} from '../assets/js/portal/observatorio-conta-model.js'
import {accountLink,mountAccount} from '../assets/js/portal/observatorio-conta-ui.js'
import {mountInterested} from '../assets/js/portal/observatorio-interessados-ui.js'

test('conta: cadastro, retorno seguro e assinatura explícita independente do login',async()=>{
  assert.equal(await googleAvailable('https://project.example','PUBLIC',async(url,opts)=>{
    assert.equal(url,'https://project.example/auth/v1/settings');assert.equal(opts.headers.apikey,'PUBLIC')
    return {ok:true,json:async()=>({external:{google:true}})}
  }),true)
  assert.equal(await googleAvailable('https://project.example','PUBLIC',async()=>({ok:true,json:async()=>({external:{google:false}})})),false)
  assert.equal(await googleAvailable('https://project.example','PUBLIC',async()=>{throw new Error('unavailable')}),false)
  assert.equal(await googleAvailable('https://project.example','PUBLIC',async()=>({ok:false})),false)
  const input=signupInput({nome:' Maria ',email:'MARIA@example.org ',password:'senha-forte',confirm_password:'senha-forte'})
  assert.deepEqual(input,{email:'maria@example.org',password:'senha-forte',options:{data:{nome:'Maria'}}})
  assert.ok(!('assinatura' in input.options.data))
  for(const values of [{nome:'a'},{nome:'Maria',email:'invalid'},{nome:'Maria',email:'m@example.org',password:'123',confirm_password:'123'},
    {nome:'Maria',email:'m@example.org',password:'12345678',confirm_password:'87654321'}])assert.throws(()=>signupInput(values))
  const current='https://example.org/unesp.ia/participar-observatorio.html'
  for(const target of ['https://evil.org','//evil.org','javascript:alert(1)','https://user:secret@example.org/'])
    assert.equal(safeAccountReturn(target,current),'https://example.org/unesp.ia/minha-conta-observatorio.html')
  assert.equal(safeAccountReturn('sugerir-observacao.html',current),'https://example.org/unesp.ia/sugerir-observacao.html')
  for(const target of ['javascript:alert(1)','https://user:secret@example.org','bad'])assert.equal(accountLink(target),null)
  assert.equal(suggestionLabel('publicada'),'Publicada')
  const calls=[],db={rpc:(name,args)=>({then:resolve=>resolve((calls.push({name,args}),{data:{ok:true}}))})}
  await saveAccount(db,' Maria ',true);await saveAccount(db,'Maria',false)
  assert.equal(calls[0].args.p_consentimento,CONSENT_VERSION)
  assert.equal(calls[1].args.p_consentimento,null)
  assert.equal(calls[1].args.p_assinatura,false)
})

test('PostgreSQL: conta privada, confirmação, consentimento, isolamento, limites e curadoria', {skip:!process.env.RADAR_PGLITE_MODULE},async()=>{
  const {PGlite}=await import(pathToFileURL(process.env.RADAR_PGLITE_MODULE).href)
  const db=new PGlite(),uid1='11111111-1111-4111-8111-111111111111',uid2='22222222-2222-4222-8222-222222222222'
  const file=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')
  try {
    await db.exec(`create role anon;create role authenticated;create schema private;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function private.is_admin() returns boolean language sql as $$select current_setting('test.admin',true)='yes'$$;
      create function private.is_observatorio_admin() returns boolean language sql as $$select private.is_admin()$$;
      create function public.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
      grant usage on schema auth,private to authenticated;
      insert into auth.users values('${uid1}','one@example.org',now(),'{"nome":"Maria"}'),('${uid2}','two@example.org',null,'{}');`)
    await db.exec(file('202609260001_observatorio.sql'))
    await db.exec(file('202610030001_observatorio_sugestoes.sql'))
    await db.exec('alter table public.observatorio_conteudos add column aprovado_curadoria boolean default false')
    const sql=file('202610310001_observatorio_conta_assinatura.sql')
    await db.exec(sql);await db.exec(sql)
    const call=async(fn,args=[])=>{
      const placeholders=args.map((_,i)=>'$'+(i+1)).join(',')
      return (await db.query(`select public.${fn}(${placeholders}) as r`,args)).rows[0].r
    }
    const user=async id=>db.query("select set_config('test.uid',$1,false)",[id])
    await db.exec('set role anon')
    for(const [fn,args]of [['observatorio_minha_conta',[]],['observatorio_salvar_conta',['Maria',true,CONSENT_VERSION]],['observatorio_minhas_sugestoes',[1]],['observatorio_enviar_sugestao',[{}]],['observatorio_interessados_listar',['','',1]]])await assert.rejects(call(fn,args),/permission denied/)
    await db.exec('reset role;set role authenticated')
    await assert.rejects(call('observatorio_minha_conta'),/Autenticação/)
    await user(uid1)
    const initial=await call('observatorio_minha_conta')
    assert.equal(initial.assinatura,false);assert.equal(initial.nome,'Maria');assert.equal(initial.email,'one@example.org')
    await assert.rejects(db.query('select * from private.observatorio_interessados'),/permission denied/)
    await assert.rejects(call('observatorio_salvar_conta',['Maria',true,null]),/Confirme que deseja/)
    await call('observatorio_salvar_conta',['Maria',false,null])
    await call('observatorio_salvar_conta',['Maria',true,CONSENT_VERSION])
    await call('observatorio_salvar_conta',['Maria',true,CONSENT_VERSION])
    assert.equal((await call('observatorio_minha_conta')).assinatura,true)
    await assert.rejects(call('observatorio_salvar_conta',['M',false,null]),/nome/)
    await assert.rejects(call('observatorio_interessados_listar',['','',1]),/Restrito/)
    await user(uid2)
    assert.equal((await call('observatorio_minha_conta')).assinatura,false)
    await assert.rejects(call('observatorio_salvar_conta',['Outro',true,CONSENT_VERSION]),/Confirme seu e-mail/)
    await call('observatorio_salvar_conta',['Outro',false,null])
    const draft={tipo:'Notícia monitorada',categoria:'Atualidades',titulo:'Uma observação de IA',resumo:'Resumo verificável.',fonte:'Instituição',data_publicacao:'2026-10-31',url:'https://example.org/noticia',status:'publicado',revisao_humana:true,aprovado_curadoria:true,submetido_por:uid2,submetido_email:'fake@example.org'}
    await assert.rejects(call('observatorio_enviar_sugestao',[draft]),/Confirme seu e-mail/)
    await user(uid1)
    for(const bad of [{url:'javascript:alert(1)'},{url:'https://user:pass@example.org/a'},{titulo:''},{data_publicacao:'infinity'},{tipo:'ADMIN'},{resumo:'x'.repeat(1201)}])await assert.rejects(call('observatorio_enviar_sugestao',[{...draft,...bad}]))
    const created=await call('observatorio_enviar_sugestao',[draft])
    assert.equal(created.duplicada,false)
    assert.equal((await call('observatorio_enviar_sugestao',[draft])).duplicada,true)
    await assert.rejects(db.query(`insert into public.observatorio_conteudos(colecao,tipo,categoria,titulo,resumo,data_publicacao,url,fonte,origem,status,revisao_humana,destaque,submetido_por) values('Observatório','Pesquisa','IA','Atalho','Resumo',current_date,'https://example.org/bypass','Fonte','Usuário identificado','revisao',false,false,'${uid1}')`),/row-level security/)
    const history=await call('observatorio_minhas_sugestoes',[1])
    assert.equal(history.total,1);assert.equal(history.itens[0].situacao,'aguardando_revisao')
    assert.ok(!JSON.stringify(history).includes('submetido_email'))
    await user(uid2);assert.equal((await call('observatorio_minhas_sugestoes',[1])).total,0)
    await user(uid1)
    for(let n=2;n<=10;n++)await call('observatorio_enviar_sugestao',[{...draft,url:`https://example.org/${n}`}])
    await assert.rejects(call('observatorio_enviar_sugestao',[{...draft,url:'https://example.org/11'}]),/Limite de 10/)
    await call('observatorio_salvar_conta',['Maria',false,null])
    assert.equal((await call('observatorio_minha_conta')).assinatura,false)
    assert.equal((await call('observatorio_minhas_sugestoes',[1])).total,10)
    await db.exec("select set_config('test.admin','yes',false)")
    assert.equal((await call('observatorio_interessados_listar',['cancelado','Maria',1])).total,1)
    assert.equal((await call('observatorio_interessados_listar',['pendente','',1])).total,1)
    await assert.rejects(call('observatorio_interessados_listar',['unknown','',1]),/inválidos/)
    await db.exec('reset role')
    const stored=(await db.query('select * from public.observatorio_conteudos where id=$1',[created.id])).rows[0]
    assert.equal(stored.status,'revisao');assert.equal(stored.revisao_humana,false);assert.equal(stored.aprovado_curadoria,false)
    assert.equal(stored.submetido_por,uid1);assert.equal(stored.submetido_email,'one@example.org')
    assert.equal((await db.query('select count(*)::int n from private.observatorio_assinatura_eventos')).rows[0].n,2)
    await db.query("update public.observatorio_conteudos set status='publicado',revisao_humana=true where id=$1",[created.id])
    await db.exec('set role authenticated');assert.equal((await call('observatorio_minhas_sugestoes',[1])).itens.find(i=>i.id===created.id).situacao,'publicada')
    await db.exec('reset role');await db.query("update public.observatorio_conteudos set status='arquivado' where id=$1",[created.id])
    await db.exec('set role authenticated');assert.equal((await call('observatorio_minhas_sugestoes',[1])).itens.find(i=>i.id===created.id).situacao,'nao_selecionada')
    await db.exec('reset role');await db.query('delete from auth.users where id=$1',[uid1])
    assert.equal((await db.query('select count(*)::int n from private.observatorio_assinatura_eventos')).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int n from private.observatorio_interessados')).rows[0].n,1)
  }finally{await db.close()}
})

test('interface: preferências, cancelamento, histórico seguro e filtros administrativos',async()=>{
  const oldDocument=globalThis.document
  class Node {
    constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.value='';this.disabled=false;this.hidden=false;this.textContent='';this.elements={}}
    append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=[];this.append(...nodes)}
    addEventListener(event,fn){this.listeners[event]=fn}setAttribute(){}
    set innerHTML(_){throw new Error('Não inserir HTML de usuários')}
    querySelectorAll(s){return walk(this).filter(n=>n.tag===s)}querySelector(s){return this.querySelectorAll(s)[0]}
  }
  const walk=n=>[n,...n.children.flatMap(walk)],text=n=>[n.textContent,...n.children.map(text)].join(' ')
  const flush=()=>new Promise(r=>setImmediate(r))
  try {
    globalThis.document={createElement:t=>new Node(t)}
    const map={},root={querySelector:s=>map[s]??=new Node()}
    const form=root.querySelector('[data-preferences-form]');form.elements={nome:new Node('input'),assinatura:new Node('input')}
    const submit=new Node('button');form.append(submit)
    const calls=[];let subscribed=true,fail=false
    const db={rpc:async(name,args)=>{
      calls.push({name,args})
      if(name==='observatorio_minhas_sugestoes')return {data:{total:21,itens:[{titulo:'<img onerror=alert(1)>',url:'javascript:alert(1)',created_at:'2026-10-31',situacao:'aguardando_revisao'}]}}
      if(fail)return {error:new Error('unavailable')}
      if(name==='observatorio_salvar_conta')subscribed=args.p_assinatura
      return {data:{nome:'Maria',email:'one@example.org',email_confirmado:true,assinatura:subscribed}}
    }}
    await mountAccount(root,db).load()
    assert.equal(calls.length,2);assert.ok(calls.every(c=>c.name!=='observatorio_salvar_conta'))
    assert.match(text(map['[data-my-suggestions]']),/<img onerror/)
    assert.ok(!walk(map['[data-my-suggestions]']).some(n=>n.tag==='a'))
    form.elements.nome.value=''
    map['[data-cancel-subscription]'].listeners.click();await flush()
    assert.equal(calls.find(c=>c.name==='observatorio_salvar_conta').args.p_nome,'Maria')
    assert.equal(subscribed,false);assert.equal(form.elements.assinatura.checked,false)
    assert.equal(map['[data-cancel-subscription]'].disabled,true)
    form.elements.nome.value='Maria';form.elements.assinatura.checked=true
    form.listeners.submit({preventDefault(){}});await flush()
    assert.equal(calls.at(-1).args.p_consentimento,CONSENT_VERSION)
    map['[data-suggestions-next]'].listeners.click();await flush();assert.equal(calls.at(-1).args.p_pagina,2)
    fail=true;form.listeners.submit({preventDefault(){}});await flush();assert.match(text(map['[data-account-message]']),/não foi confirmada/)
    const aMap={},aRoot={querySelector:s=>aMap[s]??=new Node()}
    const aForm=aRoot.querySelector('[data-interested-form]'),aButton=new Node('button');aForm.append(aButton)
    aForm.elements={situacao:{value:'inscrito'},busca:{value:' Maria '}}
    const adminCalls=[],admin=mountInterested(aRoot,{rpc:async(name,args)=>{adminCalls.push({name,args});return {data:{total:26,itens:[{nome:'<script>BAD</script>',email:'one@example.org',situacao:'inscrito'}]}}}})
    await admin.load();aForm.listeners.submit({preventDefault(){}});await flush()
    assert.deepEqual(adminCalls.at(-1).args,{p_situacao:'inscrito',p_busca:'Maria',p_pagina:1})
    aMap['[data-interested-next]'].listeners.click();await flush();assert.equal(adminCalls.at(-1).args.p_pagina,2)
    assert.match(text(aMap['[data-interested-results]']),/<script>BAD/)
    assert.ok(adminCalls.every(c=>c.name==='observatorio_interessados_listar'))
  }finally{globalThis.document=oldDocument}
})
