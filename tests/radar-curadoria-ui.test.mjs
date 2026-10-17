import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.listeners = {}; this.hidden = false; this.disabled = false; this.open = false; this.textContent = '' }
  append(...children) { this.children.push(...children) }
  replaceChildren() { this.children = [] }
  setAttribute() {}
  set innerHTML(_) { throw new Error('Não usar HTML de conteúdo externo') }
  addEventListener(name, fn) { this.listeners[name] = fn }
  async fire(name, event = {}) { return this.listeners[name]?.({ preventDefault() {}, ...event }) }
  querySelectorAll(selector) {
    const tags = selector.split(',')
    const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')])
    return selector === '*' ? all : all.filter(child => tags.includes(child.tag))
  }
  showModal() { this.open = true }
  close() { this.open = false }
}
const item = { titulo: '<img src=x> Estudo', resumo: 'Resumo da notícia', data_publicacao: '2026-10-16', fonte: 'Fonte',
  categoria: 'pesquisa', url: 'https://news.example.org/artigo', agente_origem: 'radar', relevancia_ia: 90 }

test('tela: prévia não grava, publicação exige confirmação, revisão e descarte são ações explícitas', async () => {
  const originalDocument = globalThis.document; const originalPrompt = globalThis.prompt
  const selectors = Object.fromEntries(['preview','decisions','editor','editor-form','editor-message','editor-close'].map(key => [`[data-radar-${key}]`, new Element()]))
  const editor = selectors['[data-radar-editor-form]']; const dialog = selectors['[data-radar-editor]']
  editor.elements = Object.fromEntries(['titulo','resumo','data_publicacao','fonte','url','categoria','confirmacao'].map(name => [name, { value: '', checked: false, required: false }]))
  editor.reportValidity = () => !editor.elements.confirmacao.required || editor.elements.confirmacao.checked
  globalThis.document = { querySelector: selector => selectors[selector], createElement: tag => new Element(tag) }
  let reason = ''; globalThis.prompt = () => reason
  let busy = false; const requests = []; let gate = null
  globalThis.__radarUiTest = {
    supabase: { rpc: async (name, args) => {
      requests.push({ name, args })
      if (gate) await gate
      return { data: { situacao: args.p_acao === 'publicar' ? 'publicado' : args.p_acao === 'descartar' ? 'descartado' : 'revisao' }, error: null }
    } },
    showMessage: (element, text) => { element.textContent = text; element.hidden = false },
  }
  try {
    let source = readFileSync(new URL('../assets/js/portal/radar-curadoria.js', import.meta.url), 'utf8')
    source = source.replace(/^import .*\r?\n/, 'const { supabase, showMessage } = globalThis.__radarUiTest\n')
    const { initRadarCuradoria } = await import(`data:text/javascript,${encodeURIComponent(source)}`)
    const controller = initRadarCuradoria({ canDecide: () => !busy, isBusy: () => busy, setBusy: value => { busy = value }, sourceLink() {} })
    controller.render([item])
    assert.equal(requests.length, 0); assert.equal(controller.hasPending(), true)
    const buttons = () => selectors['[data-radar-preview]'].querySelectorAll('button')
    await buttons()[0].fire('click')
    assert.equal(dialog.open, true)
    assert.equal(editor.elements.confirmacao.checked, false)
    await editor.fire('submit', { submitter: { value: 'publicar' } })
    assert.equal(requests.length, 0)
    editor.elements.titulo.value = 'Título corrigido'; editor.elements.confirmacao.checked = true
    await editor.fire('submit', { submitter: { value: 'publicar' } })
    assert.equal(requests.length, 1); assert.equal(requests[0].args.p_confirmacao, true)
    assert.equal(requests[0].args.p_conteudo.titulo, 'Título corrigido')
    assert.equal(controller.hasPending(), false); assert.equal(dialog.open, false)
    await buttons()[0].fire('click'); assert.equal(dialog.open, false)

    controller.render([item])
    await buttons()[0].fire('click')
    await selectors['[data-radar-editor-close]'].fire('click')
    assert.equal(requests.length, 1); assert.equal(controller.hasPending(), true)
    await buttons()[1].fire('click')
    assert.equal(requests[1].args.p_acao, 'revisao'); assert.equal(requests[1].args.p_confirmacao, false)

    controller.render([item]); reason = null
    await buttons()[2].fire('click'); assert.equal(requests.length, 2)
    reason = 'Não pertinente'
    await buttons()[2].fire('click')
    assert.equal(requests[2].args.p_acao, 'descartar'); assert.equal(requests[2].args.p_motivo, reason)
    assert.equal(controller.hasPending(), false)

    controller.render([item])
    let release
    gate = new Promise(resolve => { release = resolve })
    const first = buttons()[1].fire('click')
    await buttons()[1].fire('click')
    assert.equal(requests.length, 4)
    release(); await first; gate = null
    assert.equal(controller.hasPending(), false)

    // A candidate skipped by the bulk limit is resolved only when the curator opens it.
    const google = { ...item, url: 'https://news.google.com/rss/articles/opaque',
      observacao_colaborador: 'Link do Google Notícias — limite de lote atingido' }
    let conversions = 0
    globalThis.__radarUiTest.supabase.functions = { invoke: async (name, options) => {
      conversions++; assert.equal(name, 'observatorio-radar'); assert.equal(options.body.previa, true)
      assert.equal(options.body.acao, 'resolver_link_google'); assert.equal(busy, true)
      return { data: { acao: 'resolver_link_google', resolvido: true, url: 'https://obia.nic.br/ceticbr' } }
    } }
    controller.render([google])
    const beforeReview = requests.length
    await buttons()[0].fire('click')
    assert.equal(conversions, 1); assert.equal(requests.length, beforeReview)
    assert.equal(editor.elements.url.value, 'https://obia.nic.br/ceticbr')
    assert.equal(busy, false)
    await editor.fire('submit', { submitter: { value: 'revisao' } })
    assert.equal(conversions, 1)
    assert.equal(requests.at(-1).args.p_conteudo.url, 'https://obia.nic.br/ceticbr')
    assert.equal(requests.at(-1).args.p_conteudo.observacao_colaborador, undefined)

    // A failed individual lookup remains explicit and does not publish or write on opening.
    globalThis.__radarUiTest.supabase.functions.invoke = async () => ({ data: {
      acao: 'resolver_link_google', resolvido: false, diagnostico: 'pagina: HTTP 429',
    } })
    controller.render([{ ...item, url: 'https://news.google.com/rss/articles/failure' }])
    const beforeFailure = requests.length
    await buttons()[0].fire('click')
    assert.equal(requests.length, beforeFailure)
    assert.match(editor.elements.url.value, /news.google.com/)
    assert.match(selectors['[data-radar-editor-message]'].textContent, /HTTP 429/)
  } finally {
    globalThis.document = originalDocument; globalThis.prompt = originalPrompt; delete globalThis.__radarUiTest
  }
})
