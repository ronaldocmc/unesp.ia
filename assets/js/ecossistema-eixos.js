import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, configReady } from './portal/config.js'

const axisIcons={
  aprender:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 12h14c3 0 5 2 5 5v23c0-3-2-5-5-5H7V12Zm34 0H27c-3 0-5 2-5 5v23c0-3 2-5 5-5h14V12Z"/><path d="M14 19h7M14 25h7M34 19h-7M34 25h-7"/></svg>',
  experimentar:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 5h12M21 5v11L10 35a5 5 0 0 0 4 8h20a5 5 0 0 0 4-8L27 16V5"/><path d="M15 31h18M19 36h2M27 36h2"/></svg>',
  pesquisa:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="21" cy="21" r="13"/><path d="m31 31 11 11M21 14v14M14 21h14"/></svg>',
  inovacao:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 31c-4-3-6-7-6-12a14 14 0 1 1 28 0c0 5-2 9-6 12-2 2-3 4-3 7H19c0-3-1-5-3-7Z"/><path d="M19 42h10M24 2v5M7 19H2M46 19h-5M9 7l4 4M39 7l-4 4"/></svg>'
};

function externalAttributes(link,data){
  if(!data.externo)return;
  link.target='_blank';
  link.rel='noopener';
}

function axisCard(axis){
  const article=document.createElement('article');
  article.className=`ecosystem-axis-card axis-${axis.id}`;
  article.id=axis.id;

  const head=document.createElement('div');
  head.className='axis-card-head';
  const icon=document.createElement('span');
  icon.className='axis-icon';
  icon.innerHTML=axisIcons[axis.id]||axisIcons.pesquisa;
  const identity=document.createElement('div');
  const order=document.createElement('span');
  order.className='axis-order';
  order.textContent=`Eixo ${axis.ordem}`;
  const title=document.createElement('h3');
  title.textContent=axis.nome;
  const label=document.createElement('p');
  label.className='axis-label';
  label.textContent=axis.rotulo;
  identity.append(order,title,label);
  head.append(icon,identity);

  const description=document.createElement('p');
  description.className='axis-description';
  description.textContent=axis.descricao;

  const highlights=document.createElement('ul');
  highlights.className='axis-highlights';
  axis.destaques.forEach(item=>{const li=document.createElement('li');li.textContent=item;highlights.append(li);});

  const initiatives=document.createElement('div');
  initiatives.className='axis-initiatives';
  axis.iniciativas.forEach(item=>{
    const row=document.createElement(item.href?'a':'div');
    row.className='axis-initiative';
    if(item.href){row.href=item.href;externalAttributes(row,item);}
    const name=document.createElement('strong');name.textContent=item.nome;
    const detail=document.createElement('span');detail.textContent=item.descricao;
    row.append(name,detail);initiatives.append(row);
  });

  const action=document.createElement('a');
  action.className='axis-action';
  action.href=axis.acao.href;
  action.textContent=axis.acao.rotulo;
  externalAttributes(action,axis.acao);
  const arrow=document.createElement('span');
  arrow.setAttribute('aria-hidden','true');
  arrow.textContent=axis.acao.externo?'↗':'→';
  action.append(arrow);

  article.append(head,description,highlights,initiatives,action);
  return article;
}

async function loadAxes(){
  const target=document.getElementById('ecosystem-axes-grid');
  if(!target)return;
  try{
    const response=await fetch('assets/data/ecossistema-eixos.json');
    if(!response.ok)throw new Error('Eixos indisponíveis');
    const fallback=await response.json();
    const axes=await loadPublishedAxes(fallback);
    target.replaceChildren(...axes.map(axisCard));
    const hashTarget=location.hash&&document.querySelector(location.hash);
    if(hashTarget&&['aprender','experimentar','pesquisa','inovacao'].includes(hashTarget.id)) requestAnimationFrame(()=>hashTarget.scrollIntoView({block:'start'}));
  }catch(error){
    const message=document.createElement('p');
    message.className='ecosystem-data-message';
    message.textContent='Os eixos do ecossistema estarão disponíveis quando o portal for acessado pelo servidor web.';
    target.replaceChildren(message);
  }
}

function normalizeHighlights(value){
  if(Array.isArray(value))return value;
  return String(value||'').split(',').map(item=>item.trim()).filter(Boolean);
}

async function loadPublishedAxes(fallback){
  if(!configReady())return fallback;
  const headers={apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`};
  const base=`${SUPABASE_URL}/rest/v1`;
  try{
    const [axesResponse,initiativesResponse]=await Promise.all([
      fetch(`${base}/ecossistema_eixos?select=*&status=eq.publicado&revisao_humana=eq.true&order=ordem.asc`,{headers}),
      fetch(`${base}/ecossistema_iniciativas?select=*&status=eq.publicado&revisao_humana=eq.true&order=ordem.asc`,{headers})
    ]);
    if(!axesResponse.ok||!initiativesResponse.ok)return fallback;
    const [rows,initiatives]=await Promise.all([axesResponse.json(),initiativesResponse.json()]);
    if(!rows.length)return fallback;
    return rows.map(axis=>({
      id:axis.id,
      ordem:String(axis.ordem).padStart(2,'0'),
      nome:axis.nome,
      rotulo:axis.rotulo,
      descricao:axis.descricao,
      destaques:normalizeHighlights(axis.destaques),
      iniciativas:initiatives.filter(item=>item.eixo===axis.id).map(item=>({nome:item.nome,descricao:item.descricao,href:item.url,externo:item.externo})),
      acao:{rotulo:axis.acao_rotulo,href:axis.acao_url,externo:axis.acao_externa}
    }));
  }catch(error){
    console.info('Dados locais dos eixos utilizados.',error);
    return fallback;
  }
}

document.addEventListener('DOMContentLoaded',loadAxes);
