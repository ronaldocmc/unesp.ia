const labels={inscrito:'Inscrito confirmado',cancelado:'Cancelado',nao_inscrito:'Não inscrito',pendente:'E-mail pendente'}
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
export function mountInterested(root,db) {
  const $=s=>root.querySelector(s),form=$('[data-interested-form]'),status=$('[data-interested-message]'),out=$('[data-interested-results]')
  const prev=$('[data-interested-prev]'),next=$('[data-interested-next]'),button=form.querySelector('button')
  let page=1,filters={p_situacao:'',p_busca:''},request=0
  async function load(){
    const version=++request
    button.disabled=prev.disabled=next.disabled=true;status.textContent='Consultando…';out.replaceChildren()
    try {
      const {data,error}=await db.rpc('observatorio_interessados_listar',{...filters,p_pagina:page})
      if(version!==request)return
      if(error || !Array.isArray(data?.itens))throw error || new Error()
      const table=el('table'),head=el('thead'),tr=el('tr'),body=el('tbody')
      for(const label of ['Nome','E-mail','Situação','Inscrição','Cancelamento']){const th=el('th',label);th.scope='col';tr.append(th)}
      head.append(tr);table.append(head,body)
      for(const row of data.itens){
        const tr=el('tr')
        for(const value of [row.nome,row.email,labels[row.situacao]||row.situacao,row.inscrito_em,row.cancelado_em])tr.append(el('td',value || '—'))
        body.append(tr)
      }
      if(data.itens.length)out.append(table);else out.append(el('p','Nenhum interessado corresponde aos filtros.'))
      status.textContent=`${data.total} registro(s). Nenhum e-mail enviado.`
      $('[data-interested-page]').textContent=`Página ${page} de ${Math.max(1,Math.ceil(data.total/25))}`
      prev.disabled=page<=1;next.disabled=page*25>=data.total
    }catch{if(version===request)status.textContent='Consulta indisponível. Confira sua permissão de administrador e a migration de conta e assinatura.'}
    finally{if(version===request)button.disabled=false}
  }
  form.addEventListener('submit',e=>{e.preventDefault();page=1;filters={p_situacao:form.elements.situacao.value,p_busca:form.elements.busca.value.trim()};void load()})
  prev.addEventListener('click',()=>{if(page>1){page--;void load()}})
  next.addEventListener('click',()=>{if(!next.disabled){page++;void load()}})
  return {load}
}
