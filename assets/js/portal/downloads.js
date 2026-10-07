import { supabase, showMessage } from './supabase.js'

const list = document.querySelector('[data-download-list]')
const message = document.querySelector('[data-download-message]')

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`
}

function downloadCard(item) {
  const meta = [item.categoria, item.tipo_arquivo, formatBytes(item.tamanho_bytes)].filter(Boolean).join(' · ')
  return `<article class="download-card">
    <h2>${escapeHtml(item.titulo)}</h2>
    ${item.descricao ? `<p>${escapeHtml(item.descricao)}</p>` : ''}
    ${meta ? `<span class="download-meta">${escapeHtml(meta)}</span>` : ''}
    <a class="lab-button" href="${escapeHtml(item.arquivo_url)}" target="_blank" rel="noopener">Baixar arquivo <span aria-hidden="true">→</span></a>
  </article>`
}

async function loadDownloads() {
  if (!supabase) {
    showMessage(message, 'Configure o Supabase para carregar os downloads.', 'error')
    return
  }
  showMessage(message, 'Carregando arquivos disponíveis...', 'info')
  const { data, error } = await supabase
    .from('observatorio_downloads')
    .select('titulo,descricao,categoria,arquivo_url,tipo_arquivo,tamanho_bytes,ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('titulo', { ascending: true })
  if (error) {
    showMessage(message, error.message, 'error')
    return
  }
  list.innerHTML = (data || []).map(downloadCard).join('') || '<article class="download-card"><h2>Nenhum arquivo disponível</h2><p>Os downloads serão exibidos aqui assim que forem publicados pela administração do Observatório.</p></article>'
  message.hidden = true
}

loadDownloads()
