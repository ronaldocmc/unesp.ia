import { mountAccessReport } from './observatorio-acessos-admin.js?v=20261102'
import { mountGeoReport } from './observatorio-acessos-mapa.js?v=20261102'

// Each view preserves its filters; only the visible workspace changes.
export function mountAdminReports(workspace, db, beforeOpen) {
  const access = mountAccessReport(workspace, db, { separate: true })
  const geo = document.createElement('section')
  workspace.prepend(geo)
  const geoReport = mountGeoReport(geo, db)
  access.hidden = geo.hidden = true
  const panels = { access, geo }
  const buttons = [...document.querySelectorAll('[data-admin-report]')]
  let previous = null
  function hide() {
    if (!previous) return
    previous.forEach(([child, hidden]) => { child.hidden = hidden })
    previous = null
    access.hidden = geo.hidden = true
    buttons.forEach(button => { button.classList.remove('active'); button.removeAttribute('aria-current') })
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    beforeOpen()
    hide()
    previous = [...workspace.children].map(child => [child, child.hidden])
    previous.forEach(([child]) => { child.hidden = true })
    const panel = panels[button.dataset.adminReport]
    panel.hidden = false
    document.querySelectorAll('[data-admin-tab]').forEach(tab => tab.classList.remove('active'))
    button.classList.add('active'); button.setAttribute('aria-current', 'page')
    const heading = panel.querySelector('h2,h3')
    heading.tabIndex = -1; heading.focus()
    if (panel === geo) geoReport.resize()
  }))
  document.querySelector('[data-admin-analytics]').hidden = false
  return { hide }
}
