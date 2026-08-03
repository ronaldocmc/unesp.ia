
function filterCards(){const q=document.getElementById('searchBox')?.value.toLowerCase()||'';document.querySelectorAll('[data-search]').forEach(el=>{el.style.display=el.dataset.search.toLowerCase().includes(q)?'':'none'})}

document.addEventListener('DOMContentLoaded',()=>{
  const legacyUnit=location.pathname.match(/\/unidades\/m1-u([3-7])\.html$/);
  if(legacyUnit){
    const anchors={
      '3':'unidade-1-3-areas-da-inteligencia-artificial-e-aplicacoes-no-cotidiano',
      '4':'unidade-1-4-primeiros-usos-com-ferramentas-de-ia-e-prompts',
      '5':'unidade-1-5-seguranca-etica-privacidade-e-lgpd',
      '6':'unidade-1-6-laboratorio-integrador',
      '7':'unidade-1-6-laboratorio-integrador'
    };
    location.replace(`../modulos/m1.html#${anchors[legacyUnit[1]]}`);
    return;
  }
});
