import useStore from './store.js'
import { createSocketClient } from './utils/socketClient.js'
let client
export function resolveWebSocketUrl() {
  const configured = import.meta.env?.VITE_WS_URL
  if (configured) return configured
  if (typeof window === 'undefined') return 'ws://localhost:8000/ws'
  const isHttps = window.location.protocol === 'https:'
  const wsProto = isHttps ? 'wss' : 'ws'
  const host = window.location.hostname || 'localhost'
  const port = window.location.port

  // In local Vite dev (port 5173 or 3000), backend is on port 8000
  if (port === '5173' || port === '3000') {
    const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
    return `${wsProto}://${bracketed}:8000/ws`
  }

  // Localhost test or fallback without port
  if ((host === 'localhost' || host === '127.0.0.1') && (!port || port === '8000')) {
    return `${wsProto}://${host}:8000/ws`
  }

  // Live production deployment (Render, Railway, custom domain)
  return `${wsProto}://${window.location.host}/ws`
}
function getClient() {
  if (!client) client = createSocketClient({
    getUrl: resolveWebSocketUrl, Socket: globalThis.WebSocket,
    onConnection: (status) => {
      useStore.getState().setConnected(status === 'connected')
      useStore.getState().setConnectionState(status)
    },
    onWarning: (message) => useStore.setState({ connectionError: message }),
    onMessage: (data) => {
      if (data.warehouse) useStore.getState().setWarehouse(data.warehouse)
      useStore.getState().updateState(data)
    },
  })
  return client
}
export function connectWebSocket() { return getClient().connect() }
export function sendCommand(action, params) { return client?.send(action, params) ?? false }
export function __getSocketForTests() { return client?.getSocket() ?? null }
