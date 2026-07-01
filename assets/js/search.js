
function filterCards(){const q=document.getElementById('searchBox')?.value.toLowerCase()||'';document.querySelectorAll('[data-search]').forEach(el=>{el.style.display=el.dataset.search.toLowerCase().includes(q)?'':'none'})}
