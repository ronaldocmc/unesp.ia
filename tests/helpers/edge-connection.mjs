export function edgeFixtureResponse(html, headers = {}) {
  const bytes = new TextEncoder().encode(html)
  return new TextEncoder().encode('HTTP/1.1 200 OK\r\n' + Object.entries({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': bytes.length, ...headers })
    .map(([name, value]) => `${name}: ${value}`).join('\r\n') + '\r\n\r\n' + html)
}

export function mockEdgeNetwork(reply, { packetSize = 4096, handshakeError = null } = {}) {
  const calls = [], requests = []; let closes = 0
  const network = {
    async connect(options) {
      calls.push({ operation: 'connect', ...options })
      return { close() { closes++ } }
    },
    async startTls(raw, options) {
      calls.push({ operation: 'tls', ...options })
      let request = '', response, offset = 0
      return {
        async handshake() { if (handshakeError) throw handshakeError },
        async write(bytes) { request += new TextDecoder().decode(bytes); return bytes.length },
        async read(buffer) {
          if (!response) {
            requests.push(request)
            response = await reply(request)
            if (typeof response === 'string') response = new TextEncoder().encode(response)
          }
          if (offset === response.length) return null
          const count = Math.min(packetSize, buffer.length, response.length - offset)
          buffer.set(response.subarray(offset, offset + count)); offset += count; return count
        },
        close() { closes++; raw.close() },
      }
    },
  }
  return { network, calls, requests, get closes() { return closes } }
}
