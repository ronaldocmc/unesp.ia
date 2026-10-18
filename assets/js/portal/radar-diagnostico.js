// Only controlled values are exported. Never copy raw bodies, headers, tokens or user data.
const UI_VERSION = '20261018-diagnostico'

function publicHost(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ? url.hostname : null
  } catch { return null }
}

function reasonCode(value) {
  if (typeof value !== 'string') return null
  if (/HTTP 429/.test(value)) return 'google_limite_de_acessos_429'
  if (/tempo limite/i.test(value)) return 'tempo_limite'
  if (/limite de 10|tempo total de 20/i.test(value)) return 'limite_do_lote'
  if (/sem parâmetros/i.test(value)) return 'google_sem_parametros_de_conversao'
  if (/formato.*não reconhecido/i.test(value)) return 'formato_google_nao_reconhecido'
  if (/identificador inválido/i.test(value)) return 'identificador_invalido'
  if (/HTTP \d{3}/.test(value)) return 'google_erro_http'
  if (/rede ou validação/i.test(value)) return 'rede_ou_validacao'
  if (/excede 2 MB/i.test(value)) return 'pagina_muito_grande'
  return 'motivo_nao_classificado'
}

export function buildRadarLinkDiagnostic({ inputURL, data, error, httpStatus } = {}) {
  const status = Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null
  const compatible = data?.acao === 'resolver_link_google'
  return {
    versao_tela: UI_VERSION,
    acao_solicitada: 'resolver_link_google',
    estado: error ? (status ? 'erro_http' : 'erro_rede_ou_cors')
      : compatible ? (data.resolvido === true ? 'resolvido' : 'nao_resolvido') : 'resposta_incompativel',
    http_status: status,
    acao_reconhecida: compatible,
    resolvido: compatible && typeof data.resolvido === 'boolean' ? data.resolvido : null,
    dominio_entrada: publicHost(inputURL),
    dominio_resultado: compatible ? publicHost(data.url) : null,
    motivo: status === 401 ? 'autenticacao' : status === 403 ? 'permissao'
      : reasonCode(data?.diagnostico),
    resposta_de_busca: !compatible && (Array.isArray(data?.previas) || Array.isArray(data?.fontes)),
  }
}

export async function readRadarFunctionError(error) {
  const response = error?.context
  if (!response || typeof response.clone !== 'function') return { httpStatus: null, data: null }
  const httpStatus = response.status
  let reader
  const timer = setTimeout(() => { reader?.cancel().catch(() => {}) }, 2000)
  try {
    reader = response.clone().body?.getReader()
    if (!reader) return { httpStatus, data: null }
    const chunks = []; let length = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.length
      if (length > 8192) return { httpStatus, data: null }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length); let offset = 0
    for (const value of chunks) { bytes.set(value, offset); offset += value.length }
    return { httpStatus, data: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch { return { httpStatus, data: null } }
  finally {
    clearTimeout(timer)
    if (reader) { reader.cancel().catch(() => {}); reader.releaseLock() }
  }
}
