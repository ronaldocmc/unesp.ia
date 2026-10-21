import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildRadarLinkDiagnostic, readRadarFunctionError } from '../assets/js/portal/radar-diagnostico.js'

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
  focus() { this.focused = true }
  select() { this.selected = true }
}
const item = { titulo: '<img src=x> Estudo', resumo: 'Resumo da notícia', data_publicacao: '2026-10-16', fonte: 'Fonte',
  categoria: 'pesquisa', url: 'https://news.example.org/artigo', agente_origem: 'radar', relevancia_ia: 90 }

test('tela: prévia não grava, publicação exige confirmação, revisão e descarte são ações explícitas', async () => {
  const originalDocument = globalThis.document; const originalPrompt = globalThis.prompt
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  let copied = ''
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => { copied = value } } } })
  const selectors = Object.fromEntries(['preview','decisions','editor','editor-form','editor-message','editor-close','copy-diagnostic','diagnostic-output'].map(key => [`[data-radar-${key}]`, new Element()]))
  const editor = selectors['[data-radar-editor-form]']; const dialog = selectors['[data-radar-editor]']
  editor.elements = Object.fromEntries(['titulo','resumo','data_publicacao','fonte','url','categoria','confirmacao'].map(name => [name, { value: '', checked: false, required: false }]))
  editor.reportValidity = () => !editor.elements.confirmacao.required || editor.elements.confirmacao.checked
  globalThis.document = { querySelector: selector => selectors[selector], createElement: tag => new Element(tag) }
  let reason = ''; globalThis.prompt = () => reason
  let busy = false; const requests = []; let gate = null
  globalThis.__radarUiTest = {
    buildRadarLinkDiagnostic, readRadarFunctionError,
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
    source = source.replace(/^import .*radar-diagnostico[^\r\n]*\r?\n/m, 'const { buildRadarLinkDiagnostic, readRadarFunctionError } = globalThis.__radarUiTest\n')
    const { initRadarCuradoria } = await import(`data:text/javascript,${encodeURIComponent(source)}`)
    let scheduledPoll = null
    const controller = initRadarCuradoria({ canDecide: () => !busy, isBusy: () => busy, setBusy: value => { busy = value }, sourceLink() {},
      schedule: callback => { scheduledPoll = callback; return 1 }, cancelSchedule: () => { scheduledPoll = null } })
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
    await selectors['[data-radar-copy-diagnostic]'].fire('click')
    assert.equal(JSON.parse(copied).motivo, 'google_limite_de_acessos_429')
    assert.equal(JSON.parse(copied).estado, 'nao_resolvido')
    assert.equal(requests.length, beforeFailure)
    assert.equal(selectors['[data-radar-diagnostic-output]'].hidden, false)
    globalThis.navigator.clipboard.writeText = async () => { throw new Error('Permission denied') }
    await selectors['[data-radar-copy-diagnostic]'].fire('click')
    assert.equal(selectors['[data-radar-diagnostic-output]'].selected, true)
    assert.match(selectors['[data-radar-editor-message]'].textContent, /Ctrl\+C/)

    // The curator can paste the URL reached in the other tab despite a Google 429.
    const ifmg = 'https://www.ifmg.edu.br/portal/noticias/vagas-abertas-em-pos-graduacao-gratuita-em-inteligencia-artificial'
    globalThis.__radarUiTest.supabase.functions.invoke = async () => { throw new Error('Não consultar Google para URL manual') }
    for (const invalid of ['javascript:alert(1)', 'http://example.org/noticia', 'https://user:pass@example.org/noticia', 'https://127.0.0.1/noticia']) {
      editor.elements.url.value = invalid
      await editor.fire('submit', { submitter: { value: 'revisao' } })
      assert.equal(requests.length, beforeFailure)
      assert.match(selectors['[data-radar-editor-message]'].textContent, /HTTPS público válido/)
    }
    editor.elements.url.value = ifmg
    await editor.fire('input', { target: { name: 'url' } })
    assert.match(selectors['[data-radar-editor-message]'].textContent, /informado manualmente/)
    assert.equal(requests.length, beforeFailure)
    await editor.fire('submit', { submitter: { value: 'publicar' } })
    assert.equal(requests.length, beforeFailure) // Still requires human confirmation.
    await editor.fire('submit', { submitter: { value: 'revisao' } })
    assert.equal(requests.length, beforeFailure + 1)
    assert.equal(requests.at(-1).args.p_conteudo.url, ifmg)
    assert.equal(requests.at(-1).args.p_conteudo.observacao_colaborador, undefined)
    assert.equal(requests.at(-1).args.p_confirmacao, false)
    assert.ok(!selectors['[data-radar-preview]'].children[0].children[1].textContent.includes('Google Notícias'))
    // A fila atualiza a revisão aberta consultando somente cache, sem criar conteúdo.
    controller.render([{ ...item, url: 'https://news.google.com/rss/articles/queued' }])
    const invocations = []
    globalThis.__radarUiTest.supabase.functions.invoke = async (_name, args) => {
      invocations.push(args.body)
      return { data: args.body.somente_cache
        ? { acao: 'resolver_link_google', resolvido: true, fila: 'resolvido', cache: true, url: 'https://publisher.org/noticia' }
        : { acao: 'resolver_link_google', resolvido: false, fila: 'pendente', diagnostico: 'Pausa Google 429' } }
    }
    await buttons()[0].fire('click')
    assert.equal(typeof scheduledPoll, 'function')
    await scheduledPoll()
    assert.equal(invocations.length, 2); assert.equal(invocations[1].somente_cache, true)
    assert.equal(editor.elements.url.value, 'https://publisher.org/noticia')
    assert.equal(requests.length, beforeFailure + 1) // Polling never saves a publication.
    // Se a pessoa colou outro endereço, nem consulta a fila para sobrescrevê-lo.
    controller.render([{ ...item, url: 'https://news.google.com/rss/articles/queued-manual' }])
    await buttons()[0].fire('click')
    const scheduledBeforeEdit = scheduledPoll
    editor.elements.url.value = 'https://manual.org/correto'
    await scheduledBeforeEdit()
    assert.equal(editor.elements.url.value, 'https://manual.org/correto'); assert.equal(invocations.length, 3)
    // Reabre apenas uma falha explícita, sem disparar coleta ou zerar bloqueios.
    controller.render([{ ...item, url: 'https://news.google.com/rss/articles/retry-id?oc=5' }])
    globalThis.__radarUiTest.supabase.functions.invoke = async () => ({ data: {
      acao: 'resolver_link_google', resolvido: false, fila: 'falhou', diagnostico: 'Limite de tentativas atingido',
    } })
    await buttons()[0].fire('click')
    const retryButton = buttons().find(button => button.textContent === 'Reprocessar link')
    assert.equal(retryButton.hidden, false)
    const oldRPC = globalThis.__radarUiTest.supabase.rpc
    let retried
    globalThis.__radarUiTest.supabase.rpc = async (name, args) => { retried = { name, args }; return { data: { ok: true } } }
    await retryButton.fire('click')
    assert.equal(retried.name, 'observatorio_resolucao_reprocessar')
    assert.equal(retried.args.p_chave, 'https://news.google.com/articles/retry-id')
    assert.equal(retryButton.hidden, true)
    globalThis.__radarUiTest.supabase.rpc = oldRPC
    // Real HTTP errors retain their status without copying raw error bodies.
    controller.render([{ ...item, url: 'https://news.google.com/rss/articles/http-error' }])
    globalThis.__radarUiTest.supabase.functions.invoke = async () => ({ error: {
      context: Response.json({ error: 'Invalid JWT', token: 'private-token' }, { status: 401 }),
    } })
    await buttons()[0].fire('click')
    assert.match(selectors['[data-radar-editor-message]'].textContent, /HTTP 401/)
    await selectors['[data-radar-copy-diagnostic]'].fire('click')
    const httpDiagnostic = JSON.parse(selectors['[data-radar-diagnostic-output]'].value)
    assert.equal(httpDiagnostic.http_status, 401)
    assert.equal(httpDiagnostic.motivo, 'autenticacao')
    assert.doesNotMatch(JSON.stringify(httpDiagnostic), /private-token|Invalid JWT/)
  } finally {
    globalThis.document = originalDocument; globalThis.prompt = originalPrompt; delete globalThis.__radarUiTest
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else delete globalThis.navigator
  }
})

test('campo do link original é editável e explica como copiar o destino final', () => {
  const html = readFileSync(new URL('../radar.html', import.meta.url), 'utf8')
  const input = html.match(/<input\b[^>]*name="url"[^>]*>/)?.[0]
  assert.ok(input); assert.doesNotMatch(input, /readonly/)
  assert.match(input, /maxlength="2048"/)
  assert.match(html, /copie o endereço final da barra do navegador/)
})
