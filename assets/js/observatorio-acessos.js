import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, configReady } from './portal/config.js'

const STORAGE_KEY = 'observar-acessos-sessao-v1'
export function createTracker({ storage, uuid, send, now = Date.now, enabled = true }) {
  const sent = new Set(), pending = new Set()
  let memory
  return async function track(evento, conteudo = 0) {
    if (!enabled) return
    const time = now()
    let session = memory
    try { session = JSON.parse(storage.getItem(STORAGE_KEY)) || memory } catch { /* Sem armazenamento: sessão em memória. */ }
    if (!session || !Number.isFinite(session.last) || time - session.last >= 30 * 60000 || time < session.last) {
      session = { id: uuid(), last: time }
    }
    session.last = time; memory = session
    try { storage.setItem(STORAGE_KEY, JSON.stringify(session)) } catch { /* Não impede navegação. */ }
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(time))
    const key = `${day}:${session.id}:${evento}:${conteudo}`
    if (sent.has(key) || pending.has(key)) return
    pending.add(key)
    try {
      // Uma sessão renovada por rolagem/impressão também precisa da visita correspondente.
      if (evento !== 'visita') await track('visita')
      await send({ p_sessao: session.id, p_evento: evento, p_conteudo: conteudo })
      sent.add(key)
    } catch { /* Métricas nunca interrompem o acervo; uma interação futura pode tentar novamente. */ }
    finally { pending.delete(key) }
  }
}

export function installAccessTracking(root, { track, Observer = globalThis.IntersectionObserver } = {}) {
  const timers = new Map()
  const observer = Observer ? new Observer(entries => {
    for (const entry of entries) {
      clearTimeout(timers.get(entry.target)); timers.delete(entry.target)
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && document.visibilityState === 'visible') {
        timers.set(entry.target, setTimeout(() => {
          timers.delete(entry.target)
          if (document.visibilityState === 'visible' && entry.target.isConnected) track('visualizacao', Number(entry.target.dataset.accessId))
        }, 1000))
      }
    }
  }, { threshold: [0, 0.5] }) : null
  const stop = () => { observer?.disconnect(); for (const timer of timers.values()) clearTimeout(timer); timers.clear() }
  const scan = () => {
    stop()
    root.querySelectorAll('[data-access-id]').forEach(card => observer?.observe(card))
  }
  const click = event => {
    if (event.type === 'auxclick' && event.button !== 1) return
    const link = event.target.closest('a[data-access-click]')
    const card = link?.closest('[data-access-id]')
    if (card) track(link.dataset.accessClick, Number(card.dataset.accessId))
  }
  root.addEventListener('click', click); root.addEventListener('auxclick', click)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scan(); else stop() })
  return { scan }
}

export async function startAccessTracking(root) {
  if (!configReady() || !globalThis.crypto?.randomUUID || !/\/observatorio\.html$/.test(location.pathname)
    || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || navigator.webdriver) return null
  let storage
  try { storage = sessionStorage } catch { storage = { getItem: () => null, setItem: () => {} } }
  const track = createTracker({ storage, uuid: () => crypto.randomUUID(), send: async body => {
    const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/observatorio_acesso_registrar', {
      method: 'POST', keepalive: true, referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(5000),
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new Error('Métricas indisponíveis')
  } })
  const tracking = installAccessTracking(root, { track })
  const visit = () => { if (document.visibilityState === 'visible') void track('visita') }
  document.addEventListener('visibilitychange', visit)
  root.addEventListener('pointerdown', visit, { passive: true })
  root.addEventListener('keydown', visit)
  visit(); tracking.scan()
  return tracking
}
