/* Interface do Observatório: o acervo público é carregado somente do Supabase. */
(() => {
  'use strict';
  const model = window.ObservatoryModel;
  const state = { items: [], area: 'Todos', types: [], query: '', sort: 'featured', failed: false };
  const $ = id => document.getElementById(id);
  const areaIcons = { 'Radar de Notícias': 'radar', Dados: 'dados', Pesquisas: 'pesquisas', Avaliações: 'avaliacoes', Regulação: 'regulacao', Aplicações: 'casos', Relatórios: 'publicacoes' };
  const colors = { dados: '#008a7e', pesquisas: '#6515ed', avaliacoes: '#9c5900', regulacao: '#df104a', casos: '#006bff', publicacoes: '#6515ed', radar: '#006bff' };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'obs-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', 'assets/img/observar-ia-area-icons.svg?v=20260930#' + name);
    svg.append(use);
    return svg;
  }
  function dateLabel(value) {
    const date = new Date(String(value || '').slice(0, 10) + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replaceAll(' de ', ' ');
  }
  function linkTo(item, className, label) {
    const href = model.safeURL(item.href, location.href);
    const link = element(href ? 'a' : 'span', className, label);
    if (href) {
      link.href = href;
      if (new URL(href).origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    }
    return link;
  }
  function card(item, compact = false) {
    const area = model.areasFor(item)[0];
    const symbol = areaIcons[area] || 'radar';
    const article = element('article', 'obs-story');
    article.style.setProperty('--story-color', colors[symbol]);
    const meta = element('div', 'obs-story-meta');
    const type = item.colecao === 'unesp.IA na mídia' ? 'Na mídia' : String(item.tipo || 'Publicação');
    const typeLabel = compact && type.startsWith('Notícia') ? 'Notícia' : type;
    const time = element('time', '', dateLabel(item.data));
    if (/^\d{4}-\d{2}-\d{2}/.test(item.data || '')) time.dateTime = item.data.slice(0, 10);
    meta.append(element('span', '', typeLabel), time);
    article.append(meta);
    // Uma única área de navegação reúne capa, título e resumo, sem links aninhados.
    const content = linkTo(item, 'obs-story-content');
    if (compact) {
      const cover = element('div', 'obs-story-cover');
      cover.append(icon(symbol));
      const source = model.safeURL(item.imagem, location.href);
      if (source) {
        const img = element('img');
        img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = source;
        img.addEventListener('error', () => img.remove(), { once: true });
        cover.append(img);
      }
      if (item.destaque === true) cover.append(element('span', 'obs-featured-label', 'Destaque da curadoria'));
      content.append(cover);
    }
    const title = element('h3', '', item.titulo);
    content.append(title, element('p', 'obs-story-summary', item.resumo || ''));
    article.append(content);
    article.append(element('small', 'obs-story-source', 'Fonte: ' + (item.fonte || 'Não informada') + ' · ' + (item.revisao || 'Situação editorial não informada')));
    const read = linkTo(item, 'obs-read-more', 'Ler mais ');
    if (read.tagName === 'A') {
      read.setAttribute('aria-label', 'Ler mais: ' + item.titulo);
      const arrow = element('span', '', '→'); arrow.setAttribute('aria-hidden', 'true'); read.append(arrow);
      article.append(read);
    }
    return article;
  }
  function showArchive(scroll = false) {
    if (scroll) $('acervo').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  function applyFilters() {
    const items = state.items.filter(item => model.matches(item, state));
    const byDate = (a, b) => String(a.data || '').localeCompare(String(b.data || ''));
    items.sort((a, b) => {
      if (state.sort === 'newest') return byDate(b, a);
      if (state.sort === 'oldest') return byDate(a, b);
      if (state.sort === 'title') return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
      return Number(b.destaque === true) - Number(a.destaque === true) || byDate(b, a);
    });
    const grid = $('observatory-grid');
    grid.replaceChildren(...items.map(item => card(item, true)));
    $('observatory-data-note').hidden = state.area !== 'Dados';
    $('observatory-result').textContent = state.failed ? 'Acervo temporariamente indisponível' : items.length + (items.length === 1 ? ' conteúdo encontrado' : ' conteúdos encontrados');
    $('observatory-empty').hidden = items.length > 0;
    $('observatory-empty').textContent = state.failed ? 'Não foi possível carregar o acervo. Tente recarregar a página em alguns instantes.' : 'Nenhum conteúdo publicado corresponde a esta seleção. Experimente outro tema ou limpe os filtros.';
    document.querySelectorAll('[data-observatory-filter]').forEach(button => {
      const selected = button.dataset.observatoryFilter === state.area;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function render() {
    // Inclui os tipos novos cadastrados no painel, sem perder as opções editoriais.
    const typeFilter = $('observatory-type');
    const typeOptions = typeFilter.querySelector('.obs-type-options');
    const existing = new Set([...typeFilter.querySelectorAll('input[type="checkbox"]')].map(input => input.value));
    state.items.forEach(item => {
      if (item.tipo && !existing.has(item.tipo)) {
        const label = element('label');
        const input = element('input');
        input.type = 'checkbox';
        input.value = item.tipo;
        input.addEventListener('change', () => { state.types = selectedTypes(); applyFilters(); });
        label.append(input, document.createTextNode(item.tipo));
        typeOptions.append(label);
        existing.add(item.tipo);
      }
    });
    applyFilters();
  }
  async function databaseItems() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const config = await import('./portal/config.js');
      if (!config.configReady()) return { items: [], available: false };
      const endpoint = config.SUPABASE_URL + '/rest/v1/observatorio_conteudos?select=*&status=eq.publicado&revisao_humana=eq.true&order=destaque.desc,data_publicacao.desc';
      const response = await fetch(endpoint, { signal: controller.signal, headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + config.SUPABASE_PUBLISHABLE_KEY } });
      if (!response.ok) throw new Error('Acervo remoto indisponível');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Formato remoto inválido');
      return { items: rows.map(model.fromDatabase), available: true };
    } catch { return { items: [], available: false }; }
    finally { clearTimeout(timeout); }
  }
  async function load() {
    const result = await databaseItems();
    state.items = result.items;
    state.failed = !result.available;
    render();
  }
  function reset() {
    state.area = 'Todos'; state.types = []; state.query = '';
    $('observatory-search').value = ''; $('observatory-global-search').value = ''; setTypeSelection([]);
  }
  function selectedTypes() {
    return [...$('observatory-type').querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  }
  function updateTypeSummary() {
    const summary = document.querySelector('[data-type-summary]');
    if (!summary) return;
    summary.textContent = state.types.length ? `${state.types.length} selecionado${state.types.length === 1 ? '' : 's'}` : 'Todos os tipos';
  }
  function setTypeSelection(types) {
    const selected = new Set(types);
    $('observatory-type').querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selected.has(input.value); });
    state.types = [...selected];
    updateTypeSummary();
  }
  function setTypeDropdown(open) {
    const typeFilter = $('observatory-type');
    const toggle = typeFilter.querySelector('.obs-type-toggle');
    const options = typeFilter.querySelector('.obs-type-options');
    typeFilter.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    options.hidden = !open;
  }
  const dialogs = {
    agentes: ['Arquitetura em desenvolvimento', 'Agentes Inteligentes do Observar.IA', 'Seis especialidades estão previstas: radar, dados, pesquisa, regulação, avaliação e aplicações. Os agentes poderão apoiar coleta, classificação e preparação de sínteses para a equipe.', 'A estrutura de coleta e curadoria já pode ser aproveitada. Os seis agentes especializados não estão em operação. Toda publicação exige fonte identificada e revisão humana.'],
    radar: ['Em funcionamento', 'Agente Radar', 'Busca diariamente notícias, pesquisas, ferramentas e outras publicações relevantes sobre Inteligência Artificial, organizando os conteúdos encontrados para análise.', 'Os conteúdos coletados são encaminhados à curadoria humana antes da publicação. Outros agentes serão incorporados gradualmente para acompanhar pesquisas, dados e indicadores, regulamentações, aplicações e avaliações relacionadas à IA.'],
    dados: ['Agente em desenvolvimento', 'Agente Dados', 'Função prevista: organizar bases de múltiplas fontes, registrar sua procedência, identificar atualizações e preparar indicadores comparáveis.', 'Painéis e indicadores só serão apresentados com fonte, período, metodologia e limitações.'],
    pesquisas: ['Agente em desenvolvimento', 'Agente Pesquisa', 'Função prevista: mapear artigos, teses e outras produções científicas; organizar temas e evidências relevantes no Brasil e no mundo.', 'Sínteses devem preservar as referências e distinguir resultados publicados, hipóteses e limitações.'],
    regulacao: ['Agente em desenvolvimento', 'Agente Regulação', 'Função prevista: acompanhar legislações, políticas públicas, recomendações e mudanças regulatórias relacionadas à Inteligência Artificial.', 'Cada registro deverá identificar a jurisdição, a fonte oficial, a data e a situação da norma. O conteúdo não substitui orientação jurídica.'],
    avaliacoes: ['Agente em desenvolvimento', 'Agente Avaliação', 'Função prevista: apoiar comparações de modelos, agentes e aplicações, documentando tarefas, dados, critérios e resultados.', 'Avaliações deverão ser reproduzíveis e indicar versões, limitações e possíveis conflitos de interesse. Nenhum benchmark próprio está publicado nesta etapa.'],
    casos: ['Agente em desenvolvimento', 'Agente Aplicações', 'Função prevista: identificar e analisar casos de uso da IA em educação, saúde, gestão, meio ambiente e outros setores.', 'A análise deverá distinguir propostas, experimentos e aplicações em operação, sem tratar promessas como resultados comprovados.'],
    conversa: ['Recurso em desenvolvimento', 'Converse com o Agente Observar.IA', 'Futuramente, será possível consultar o acervo em linguagem natural. O agente deverá responder com base nas fontes do Observatório, citando evidências e limites.', 'Nenhuma resposta automática está ativa. Por enquanto, use a busca e os filtros para explorar os conteúdos publicados.'],
    metodologia: ['Sobre o Observatório', 'Informação com contexto e procedência', 'O Observar.IA — Observatório de Inteligência Artificial da FCT/UNESP reúne, organiza e analisa informações para produzir dados organizados, análises, indicadores, evidências e conhecimento acessível, apoiando pesquisa, formação, inovação, disseminação do conhecimento e tomada de decisões baseada em evidências.', 'Publicações devem ter fonte identificada, data e revisão humana. O cadastro e a publicação são realizados pela equipe. Os agentes especializados são recursos previstos e não substituem a análise crítica nem a responsabilidade editorial.'],
    fontes: ['Fontes e metodologia', 'Fontes abertas, critérios transparentes', 'O Observatório reúne dados e informações de fontes públicas, bases oficiais, estudos científicos, relatórios técnicos, notícias e publicações especializadas, organismos nacionais e internacionais, instituições de pesquisa, empresas de tecnologia e iniciativas, projetos e pesquisas da UNESP.', 'As fontes efetivamente utilizadas são identificadas em cada publicação. A abrangência das fontes não significa que existam integrações automáticas com todas elas: os conteúdos são cadastrados e revisados pela equipe.'],
    contato: ['Equipe e contato', 'Fale com a equipe do Observar.IA', 'O Observar.IA integra o ecossistema unesp.IA Lab, coordenado pelo Prof. Ronaldo Celso Messias Correia, e está articulado às iniciativas do Departamento de Matemática e Computação da FCT/UNESP, Câmpus de Presidente Prudente.', 'Acesse a página própria da equipe do Observatório para acompanhar sua composição editorial, de curadoria, revisão e apoio técnico.', 'equipe-observatorio.html', 'Conhecer a equipe']
  };
  function openDialog(name) {
    const content = dialogs[name];
    if (!content) return;
    $('dialog-kicker').textContent = content[0];
    $('dialog-title').textContent = content[1];
    $('dialog-description').textContent = content[2];
    $('dialog-note').textContent = content[3];
    const link = $('dialog-link');
    link.hidden = !content[4];
    if (content[4]) { link.href = content[4]; link.textContent = content[5]; }
    $('observatory-dialog').showModal();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const requested = new URLSearchParams(location.search).get('busca');
    if (requested) {
      state.query = requested; $('observatory-search').value = requested; $('observatory-global-search').value = requested;
    }
    // Preserva links antigos de Dados sem recriar o cartão separado.
    const selectLegacyData = () => {
      if (location.hash !== '#dados') return;
      state.area = 'Dados';
      applyFilters();
    };
    selectLegacyData();
    window.addEventListener('hashchange', selectLegacyData);
    document.querySelectorAll('[data-observatory-filter]').forEach(button => button.addEventListener('click', () => {
      state.area = button.dataset.observatoryFilter;
      applyFilters();
    }));
    document.querySelectorAll('[data-observatory-shortcut]').forEach(link => link.addEventListener('click', () => {
      reset();
      const value = link.dataset.observatoryShortcut;
      if (model.AREAS.includes(value)) state.area = value; else setTypeSelection([value]);
      applyFilters();
    }));
    [$('observatory-search'), $('observatory-global-search')].forEach(input => {
      input.addEventListener('input', () => {
        state.query = input.value;
        $('observatory-search').value = input.value; $('observatory-global-search').value = input.value;
        applyFilters();
      });
      input.closest('form').addEventListener('submit', event => { event.preventDefault(); showArchive(true); });
    });
    const typeFilter = $('observatory-type');
    typeFilter.querySelector('.obs-type-toggle').addEventListener('click', () => setTypeDropdown(!typeFilter.classList.contains('open')));
    typeFilter.addEventListener('change', () => { state.types = selectedTypes(); updateTypeSummary(); applyFilters(); });
    document.addEventListener('click', event => {
      if (typeFilter.classList.contains('open') && !typeFilter.contains(event.target)) setTypeDropdown(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && typeFilter.classList.contains('open')) {
        setTypeDropdown(false);
        typeFilter.querySelector('.obs-type-toggle').focus();
      }
    });
    $('observatory-reset').addEventListener('click', () => { reset(); applyFilters(); });
    $('observatory-sort').addEventListener('change', event => { state.sort = event.target.value; applyFilters(); });
    document.querySelectorAll('[data-dialog]').forEach(trigger => trigger.addEventListener('click', event => { event.preventDefault(); openDialog(trigger.dataset.dialog); }));
    $('observatory-dialog').querySelector('.obs-dialog-close').addEventListener('click', () => $('observatory-dialog').close());
    const navigationLinks = [...document.querySelectorAll('.observatory-topbar .nav a[href^="#"]:not([data-dialog])')];
    const syncNavigation = () => {
      const hash = location.hash || '#top';
      const target = ({ '#acervo': '#areas', '#dados': '#areas', '#destaques': '#areas', '#como-funciona': '#agentes' })[hash] || hash;
      const active = navigationLinks.find(link => link.getAttribute('href') === target);
      if (!active) return;
      navigationLinks.forEach(link => link.removeAttribute('aria-current'));
      active.setAttribute('aria-current', 'location');
    };
    syncNavigation();
    window.addEventListener('hashchange', syncNavigation);
    load();
  });
})();
