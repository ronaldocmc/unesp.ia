import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as model from '../assets/js/observatorio-conversa-model.js'

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.value = ''; this.hidden = false }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); if (this.tag === 'select' && this.children.length === 1) this.value = child.value } }
  replaceChildren() { this.children = [] }
  setAttribute(name, value) { this[name] = value }
  addEventListener(name, callback) { this.events[name] = callback }
  showModal() { this.open = true }
  close() { this.open = false }
  scrollIntoView() {}
  focus() {}
  set innerHTML(_) { throw new Error('HTML injection forbidden') }
}
const walk = element => [element, ...element.children.flatMap(walk)]
test('janela começa sem LLM, consulta sem rede, renderiza texto seguro e limpa histórico', async () => {
  const originalDocument = globalThis.document, originalFetch = globalThis.fetch
  const body = new Element('body')
  globalThis.document = { body, createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('text'), { textContent: text }) }
  globalThis.fetch = () => { throw new Error('Free mode must not call network') }
  globalThis.__conversationTestModel = model
  try {
    let source = readFileSync(new URL('../assets/js/observatorio-conversa.js', import.meta.url), 'utf8')
    source = source.replace("import { searchConversation, conversationItem } from './observatorio-conversa-model.js'", 'const { searchConversation, conversationItem } = globalThis.__conversationTestModel')
    const { openConversation } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
    openConversation(() => ({ available: true, items: [{ titulo: '<script>educação</script>', tipo: 'Pesquisa', href: 'javascript:alert(1)' }] }))
    const nodes = walk(body), dialog = nodes.find(item => item.tag === 'dialog')
    const mode = nodes.find(item => item.id === 'conversation-mode'), provider = nodes.find(item => item.id === 'conversation-provider')
    const form = nodes.find(item => item.tag === 'form'), question = nodes.find(item => item.tag === 'textarea')
    assert.equal(mode.value, 'local'); assert.equal(provider.parent.hidden, true)
    question.value = 'Pesquisas sobre educação'
    await form.events.submit({ preventDefault() {} })
    assert.ok(walk(dialog).some(item => item.textContent === '<script>educação</script>'))
    assert.equal(walk(dialog).filter(item => item.tag === 'script').length, 0)
    assert.ok(walk(dialog).some(item => /nenhum LLM foi chamado/.test(item.textContent)))
    assert.equal(walk(dialog).filter(item => item.href?.startsWith('javascript:')).length, 0)
    mode.value = 'llm'; mode.events.change(); assert.equal(provider.parent.hidden, false)
    const consent = nodes.find(item => item.type === 'checkbox'); assert.equal(consent.required, true); assert.equal(consent.checked, false)
    nodes.find(item => item.textContent === 'Limpar conversa').events.click()
    assert.equal(walk(dialog).filter(item => item.className === 'obs-conversation-turn').length, 0)
    openConversation(() => ({})); assert.equal(body.children.length, 1)
  } finally { globalThis.document = originalDocument; globalThis.fetch = originalFetch; delete globalThis.__conversationTestModel }
})
