const observatoryDate = value => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short', year: 'numeric'
}).format(new Date(`${value}T12:00:00`));

function observatoryCard(item) {
  const article = document.createElement('article');
  article.className = 'observatory-card';
  article.dataset.type = item.tipo;
  article.dataset.category = item.categoria;
  article.dataset.search = [item.titulo, item.resumo, item.fonte, ...(item.tags || [])].join(' ').toLocaleLowerCase('pt-BR');

  const meta = document.createElement('div');
  meta.className = 'observatory-card-meta';
  const type = document.createElement('span');
  type.textContent = item.tipo;
  const date = document.createElement('time');
  date.dateTime = item.data;
  date.textContent = observatoryDate(item.data);
  meta.append(type, date);

  const category = document.createElement('p');
  category.className = 'observatory-category';
  category.textContent = item.categoria;
  const title = document.createElement('h3');
  const link = document.createElement('a');
  link.href = item.href;
  link.textContent = item.titulo;
  if (/^https?:/.test(item.href)) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  title.append(link);
  const summary = document.createElement('p');
  summary.className = 'observatory-summary';
  summary.textContent = item.resumo;

  const tags = document.createElement('ul');
  tags.className = 'observatory-tags';
  tags.setAttribute('aria-label', 'Temas');
  (item.tags || []).forEach(value => {
    const tag = document.createElement('li');
    tag.textContent = value;
    tags.append(tag);
  });

  const trust = document.createElement('div');
  trust.className = 'observatory-trust';
  const source = document.createElement('span');
  source.textContent = item.fonte;
  const review = document.createElement('span');
  review.textContent = item.revisao;
  trust.append(source, review);
  article.append(meta, category, title, summary, tags, trust);
  return article;
}

function applyObservatoryFilters() {
  const grid = document.getElementById('observatory-grid');
  if (!grid) return;
  const active = document.querySelector('[data-observatory-filter].active');
  const filter = active ? active.dataset.observatoryFilter : 'Todos';
  const query = (document.getElementById('observatory-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  let visible = 0;
  grid.querySelectorAll('.observatory-card').forEach(card => {
    const matchesType = filter === 'Todos' || card.dataset.type === filter;
    const matchesSearch = !query || card.dataset.search.includes(query);
    card.hidden = !(matchesType && matchesSearch);
    if (!card.hidden) visible += 1;
  });
  const result = document.getElementById('observatory-result');
  if (result) result.textContent = `${visible} ${visible === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados'}`;
}

async function loadObservatory() {
  const grid = document.getElementById('observatory-grid');
  if (!grid) return;
  try {
    const response = await fetch('assets/data/observatorio-conteudos.json');
    if (!response.ok) throw new Error('Conteúdo indisponível');
    const data = await response.json();
    const items = [...data.itens].sort((a, b) => b.data.localeCompare(a.data));
    grid.replaceChildren(...items.map(observatoryCard));
    const count = document.getElementById('observatory-count');
    if (count) count.textContent = items.length;
    const updated = document.getElementById('observatory-updated');
    if (updated && data.atualizadoEm) updated.textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.atualizadoEm));
    applyObservatoryFilters();
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'observatory-message';
    message.textContent = 'Os conteúdos serão exibidos quando o portal estiver disponível pelo servidor web.';
    grid.replaceChildren(message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadObservatory();
  document.querySelectorAll('[data-observatory-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-observatory-filter]').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    applyObservatoryFilters();
  }));
  document.getElementById('observatory-search')?.addEventListener('input', applyObservatoryFilters);
});
