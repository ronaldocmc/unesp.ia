import {saveAccount,suggestionLabel} from './observatorio-conta-model.js'
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
export function accountLink(value) {
  try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null} catch{return null}
}
export function mountAccount(root,db) {
  const $=s=>root.querySelector(s), form=$('[data-preferences-form]'), message=$('[data-account-message]')
  const previous=$('[data-suggestions-prev]'),next=$('[data-suggestions-next]'),cancel=$('[data-cancel-subscription]')
  let page=1, saving=false, profile=null
  const buttons=()=>[...form.querySelectorAll('button')]
  const displayProfile=data=>{
    profile=data
    form.elements.nome.value=data.nome || ''
    form.elements.assinatura.checked=data.assinatura===true
    form.elements.nome.disabled=false
    form.elements.assinatura.disabled=!data.email_confirmado
    buttons().forEach(b=>{b.disabled=false});cancel.disabled=!data.assinatura
    $('[data-account-email]').textContent=`${data.email || 'E-mail não informado'} · ${data.email_confirmado?'E-mail confirmado':'E-mail ainda não confirmado'}`
  }
  const show=(text,error=false)=>{message.textContent=text;message.hidden=false;message.className=`portal-message ${error?'error':'success'}`}
  async function save(subscribed,cancelOnly=false) {
    if(saving || !profile)return
    saving=true;buttons().forEach(b=>{b.disabled=true})
    try {
      const data=await saveAccount(db,cancelOnly?profile.nome:form.elements.nome.value,subscribed)
      displayProfile(data)
      show(subscribed?'Preferências salvas. Seu interesse no Observar.Dia está registrado; os envios ainda não começaram.':'Preferências salvas. Você não receberá o Observar.Dia. Sua conta e suas sugestões continuam disponíveis.')
    } catch {show('Não foi possível salvar. Confira seu nome, a confirmação de e-mail e tente novamente. Sua preferência não foi confirmada.',true)}
    finally {saving=false;buttons().forEach(b=>{b.disabled=false});cancel.disabled=!profile.assinatura}
  }
  async function history() {
    previous.disabled=next.disabled=true
    const status=$('[data-suggestions-message]'),out=$('[data-my-suggestions]')
    status.textContent='Consultando suas sugestões…';out.replaceChildren()
    try {
      const {data,error}=await db.rpc('observatorio_minhas_sugestoes',{p_pagina:page})
      if(error || !Array.isArray(data?.itens))throw error || new Error()
      if(page>1 && data.total<=(page-1)*20){page=Math.max(1,Math.ceil(data.total/20));return await history()}
      if(!data.itens.length)out.append(el('p','Você ainda não enviou sugestões.'))
      else {
        const table=el('table'),head=el('thead'),tr=el('tr'),body=el('tbody')
        for(const title of ['Observação sugerida','Situação','Enviada em']){const th=el('th',title);th.scope='col';tr.append(th)}
        head.append(tr);table.append(head,body)
        for(const row of data.itens){
          const tr=el('tr'),title=el('td'),url=accountLink(row.url)
          if(url){const a=el('a',row.titulo);a.href=url;a.target='_blank';a.rel='noopener noreferrer';title.append(a)}else title.textContent=row.titulo
          const date=Number.isFinite(Date.parse(row.created_at))?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(new Date(row.created_at)):'Não informada'
          tr.append(title,el('td',suggestionLabel(row.situacao)),el('td',date));body.append(tr)
        }
        out.append(table)
      }
      status.textContent=`${data.total} sugestão(ões) vinculada(s) à sua conta.`
      $('[data-suggestions-page]').textContent=`Página ${page} de ${Math.max(1,Math.ceil(data.total/20))}`
      previous.disabled=page<=1;next.disabled=page*20>=data.total
    }catch{status.textContent='Não foi possível consultar suas sugestões. Tente recarregar esta página.'}
  }
  form.addEventListener('submit',e=>{e.preventDefault();void save(form.elements.assinatura.checked)})
  cancel.addEventListener('click',()=>void save(false,true))
  previous.addEventListener('click',()=>{if(page>1){page--;void history()}})
  next.addEventListener('click',()=>{if(!next.disabled){page++;void history()}})
  return {async load(){
    try {const {data,error}=await db.rpc('observatorio_minha_conta');if(error || !data)throw error || new Error();displayProfile(data)}
    catch {show('Não foi possível carregar suas preferências. Confira a atualização do banco com a administração. Nenhuma assinatura foi alterada.',true)}
    await history()
  }}
}
