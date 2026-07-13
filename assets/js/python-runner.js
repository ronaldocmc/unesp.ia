const PYODIDE_VERSION = '0.27.7'
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
let runtimePromise

async function runtime() {
  if (!runtimePromise) runtimePromise = (async () => {
    const { loadPyodide } = await import(`${INDEX_URL}pyodide.mjs`)
    const pyodide = await loadPyodide({ indexURL: INDEX_URL })
    await pyodide.runPythonAsync(`
def display(*values):
    for value in values:
        print(value)
`)
    return pyodide
  })()
  return runtimePromise
}

async function runCell(cell) {
  const button = cell.querySelector('[data-python-run]')
  const output = cell.querySelector('.python-output')
  const source = cell.querySelector('textarea').value
  button.disabled = true
  button.textContent = 'Preparando Python...'
  output.className = 'python-output'
  output.textContent = 'Carregando o ambiente Python no navegador. A primeira execução pode demorar.'
  try {
    const pyodide = await runtime()
    button.textContent = 'Executando...'
    await pyodide.loadPackagesFromImports(source)
    let stdout = ''
    pyodide.setStdout({ batched: text => { stdout += `${text}\n` } })
    pyodide.setStderr({ batched: text => { stdout += `${text}\n` } })
    const result = await pyodide.runPythonAsync(source)
    if (result !== undefined && result !== null) stdout += String(result)
    result?.destroy?.()
    const figuresJson = await pyodide.runPythonAsync(`
import sys, io, base64, json
_figuras = []
if "matplotlib.pyplot" in sys.modules:
    import matplotlib.pyplot as _plt
    for _numero in _plt.get_fignums():
        _buffer = io.BytesIO()
        _plt.figure(_numero).savefig(_buffer, format="png", bbox_inches="tight", dpi=120)
        _figuras.append(base64.b64encode(_buffer.getvalue()).decode("ascii"))
    _plt.close("all")
json.dumps(_figuras)
`)
    const figures = JSON.parse(String(figuresJson))
    figuresJson?.destroy?.()
    output.textContent = ''
    const textOutput = document.createElement('pre')
    textOutput.textContent = stdout.trim() || (figures.length ? '' : 'Executado com sucesso, sem saída textual.')
    if (textOutput.textContent) output.append(textOutput)
    for (const encoded of figures) {
      const img = document.createElement('img')
      img.src = `data:image/png;base64,${encoded}`
      img.alt = 'Gráfico produzido pela célula Python'
      img.className = 'python-figure'
      output.append(img)
    }
  } catch (error) {
    output.className = 'python-output error'
    output.textContent = error.message || String(error)
  } finally {
    button.disabled = false
    button.textContent = 'Executar Python'
  }
}

function enhance(root = document) {
  root.querySelectorAll('pre.code-block:not([data-python-enhanced])').forEach(pre => {
    pre.dataset.pythonEnhanced = 'true'
    const source = pre.textContent.trim()
    const cell = document.createElement('div')
    cell.className = 'python-cell'
    cell.innerHTML = `<textarea spellcheck="false" aria-label="Código Python editável"></textarea><div class="python-cell-actions"><button class="btn-small" type="button" data-python-run>Executar Python</button><button class="btn-small secondary" type="button" data-python-reset>Restaurar código</button></div><div class="python-output" aria-live="polite">Edite o código se desejar e selecione “Executar Python”. As células compartilham a mesma sessão.</div>`
    cell.querySelector('textarea').value = source
    cell.querySelector('[data-python-run]').addEventListener('click', () => runCell(cell))
    cell.querySelector('[data-python-reset]').addEventListener('click', () => { cell.querySelector('textarea').value = source })
    pre.replaceWith(cell)
  })
}

enhance()
document.addEventListener('private-content-loaded', () => enhance(document.querySelector('[data-private-content]')))
