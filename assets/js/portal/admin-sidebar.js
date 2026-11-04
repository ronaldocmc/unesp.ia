const button = document.querySelector('[data-sidebar-toggle]')
const menu = document.getElementById('observatorio-menu')
const shell = document.querySelector('.admin-shell')
const preferenceKey = 'observatorio.admin.sidebar-collapsed'

if (button && menu && shell) {
  let collapsed = false
  try { collapsed = localStorage.getItem(preferenceKey) === 'true' } catch { /* Storage may be disabled. */ }
  const render = () => {
    menu.hidden = collapsed
    shell.classList.toggle('sidebar-collapsed', collapsed)
    button.setAttribute('aria-expanded', String(!collapsed))
    button.textContent = collapsed ? '☰ Mostrar menu' : '☰ Ocultar menu'
    // Let responsive components, including Leaflet, recalculate their width.
    window.dispatchEvent(new Event('resize'))
  }
  button.hidden = false
  render()
  button.addEventListener('click', () => {
    collapsed = !collapsed
    try { localStorage.setItem(preferenceKey, String(collapsed)) } catch { /* Keep the toggle usable. */ }
    render()
  })
}
