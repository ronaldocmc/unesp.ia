import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../assets/js/portal/admin-sidebar.js', import.meta.url), 'utf8')
function setup(saved, blocked = false) {
  let click, stored, resized = 0
  const button = { hidden: true, setAttribute(k, v) { this[k] = v }, addEventListener(k, fn) { click = fn } }
  const menu = {}, shell = { classList: { toggle(k, v) { shell.collapsed = v } } }
  runInNewContext(source, {
    document: { querySelector: s => s === '.admin-shell' ? shell : button, getElementById: () => menu },
    localStorage: { getItem() { if (blocked) throw Error(); return saved }, setItem(k, v) { if (blocked) throw Error(); stored = v } },
    window: { dispatchEvent() { resized++ } }, Event: class {},
  })
  return { button, menu, shell, click: () => click(), stored: () => stored, resized: () => resized }
}
test('menu opens, collapses and reopens with accessible state and persistence', () => {
  const ui = setup(null)
  assert.equal(ui.button.hidden, false)
  assert.equal(ui.menu.hidden, false)
  ui.click()
  assert.equal(ui.menu.hidden, true)
  assert.equal(ui.shell.collapsed, true)
  assert.equal(ui.button['aria-expanded'], 'false')
  assert.equal(ui.stored(), 'true')
  ui.click()
  assert.equal(ui.menu.hidden, false)
  assert.equal(ui.button['aria-expanded'], 'true')
  assert.equal(ui.resized(), 3)
})
test('restores preference and works with unavailable storage', () => {
  assert.equal(setup('true').menu.hidden, true)
  const ui = setup(null, true)
  ui.click()
  assert.equal(ui.menu.hidden, true)
})
