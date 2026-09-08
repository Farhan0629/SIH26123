import useStore from './store.js'
import { createSocketClient } from './utils/socketClient.js'
let client
export function resolveWebSocketUrl() {
  const configured = import.meta.env?.VITE_WS_URL
  if (configured) return configured
  const host = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost'
  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'}://${bracketed}:8000/ws`
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
