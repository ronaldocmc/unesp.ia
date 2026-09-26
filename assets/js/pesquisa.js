function researchElement(tag,className,text){
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}

function researchTags(items){
  const list=researchElement('ul','research-tags');
  items.forEach(item=>list.append(researchElement('li','',item)));
  return list;
}

function researchTopicGroup(group){
  const article=researchElement('article',`research-topic-group topic-${group.id}`);
  article.id=`topico-${group.id}`;
  const head=researchElement('div','research-topic-head');
  head.append(researchElement('span','research-topic-mark',' '),researchElement('h3','',group.nome));
  article.append(head,researchTags(group.itens));
  return article;
}

function projectMeta(project){
  const meta=researchElement('dl','research-project-meta');
  [['Pesquisador',project.pesquisador],['Nível',project.nivel],['Status',project.status]].forEach(([label,value])=>{
    if(!value)return;
    const row=document.createElement('div');
    row.append(researchElement('dt','',label),researchElement('dd','',value));
    meta.append(row);
  });
  return meta;
}

function researchProjectCard(project,variant='standard'){
  const article=researchElement('article',`research-project-card ${variant}`);
  article.id=project.id;
  const header=researchElement('header','research-project-header');
  const identity=document.createElement('div');
  if(project.acronimo)identity.append(researchElement('p','research-project-acronym',project.acronimo));
  identity.append(researchElement('h3','',project.nome));
  header.append(identity,researchElement('span','research-project-level',project.nivel));
  article.append(header,researchElement('p','research-project-description',project.descricao),projectMeta(project));
  if(project.topicos?.length)article.append(researchTags(project.topicos));
  if(project.links?.length){
    const links=researchElement('div','research-project-links');
    project.links.forEach(item=>{
      const link=researchElement('a','',item.rotulo);
      link.href=item.href;
      if(item.externo){link.target='_blank';link.rel='noopener';link.append(document.createTextNode(' ↗'));}
      links.append(link);
    });
    article.append(links);
  }
  return article;
}

function renderResearchSection(targetId,projects,variant){
  const target=document.getElementById(targetId);
  if(!target)return;
  target.replaceChildren(...projects.map(project=>researchProjectCard(project,variant)));
}

function renderResearchSummary(data){
  const target=document.getElementById('research-summary');
  if(!target)return;
  const values=[
    [data.topicos.length,'áreas temáticas'],
    [data.projetosEstruturantes.length,'projetos estruturantes'],
    [data.posGraduacao.length,'projetos de pós-graduação'],
    [data.iniciacaoCientifica.length,'projetos de iniciação científica']
  ];
  target.replaceChildren(...values.map(([value,label])=>{
    const item=researchElement('div','research-summary-item');
    item.append(researchElement('strong','',String(value)),researchElement('span','',label));
    return item;
  }));
}

function renderPublications(items){
  const target=document.getElementById('research-publications');
  if(!target)return;
  if(!items.length){
    const empty=researchElement('div','research-empty-state');
    empty.append(researchElement('span','research-empty-mark','＋'),researchElement('h3','','Produção científica em preparação'),researchElement('p','','Esta área está estruturada para receber artigos, dissertações, teses, datasets, softwares, repositórios e demonstrações do laboratório.'));
    target.replaceChildren(empty);
    return;
  }
  renderResearchSection('research-publications',items,'publication');
}

async function loadResearch(){
  const root=document.getElementById('research-portal');
  if(!root)return;
  try{
    const response=await fetch('assets/data/pesquisa-projetos.json');
    if(!response.ok)throw new Error('Dados de pesquisa indisponíveis');
    const data=await response.json();
    document.getElementById('research-topic-groups').replaceChildren(...data.topicos.map(researchTopicGroup));
    renderResearchSection('research-structural-projects',data.projetosEstruturantes,'featured');
    renderResearchSection('research-postgraduate-projects',data.posGraduacao,'standard');
    renderResearchSection('research-undergraduate-projects',data.iniciacaoCientifica,'compact');
    renderResearchSection('research-tcc-projects',data.tcc,'compact');
    renderPublications(data.publicacoes);
    renderResearchSummary(data);
  }catch(error){
    root.querySelectorAll('[data-research-loading]').forEach(target=>{target.textContent='O conteúdo será exibido quando o portal estiver disponível pelo servidor web.';});
  }
}

document.addEventListener('DOMContentLoaded',loadResearch);
