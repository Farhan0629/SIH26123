import useStore from './store.js'

let ws = null
let reconnectTimer = null
let consumers = 0
let shouldReconnect = false

const RECONNECT_MS = 2000

export function resolveWebSocketUrl() {
  const envUrl = typeof import.meta !== 'undefined' && import.meta?.env ? import.meta.env.VITE_WS_URL : undefined
  if (envUrl) return envUrl
  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${host}:8000/ws`
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (!shouldReconnect || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    openSocket()
  }, RECONNECT_MS)
}

function onMessage(event) {
  let data
  try {
    data = JSON.parse(event.data)
  } catch (error) {
    console.error('WebSocket parse error:', error)
    useStore.getState().setConnectionError('Received malformed update from backend.')
    return
  }

  if (data.type === 'init' || data.type === 'state_update') {
    if (data.warehouse) {
      useStore.getState().setWarehouse(data.warehouse)
    }
    useStore.getState().updateState(data)
  }
}

function openSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  useStore.getState().setConnectionState('connecting')

  try {
    ws = new WebSocket(resolveWebSocketUrl())
  } catch (error) {
    console.error('Failed to create WebSocket:', error)
    useStore.getState().setConnectionError('Failed to create websocket connection.')
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    useStore.getState().setConnected(true)
    clearReconnectTimer()
  }

  ws.onmessage = onMessage

  ws.onclose = () => {
    ws = null
    useStore.getState().setConnected(false)
    if (shouldReconnect) {
      scheduleReconnect()
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    useStore.getState().setConnectionError('Connection failed. Retrying...')
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close()
    }
  }
}

export function connectWebSocket() {
  consumers += 1
  shouldReconnect = true
  openSocket()

  return () => {
    consumers = Math.max(0, consumers - 1)
    if (consumers === 0) {
      shouldReconnect = false
      clearReconnectTimer()
      if (ws) {
        ws.onclose = null
        ws.close()
        ws = null
      }
      useStore.getState().setConnected(false)
    }
  }
}

export function sendCommand(action, params = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false
  }

  ws.send(JSON.stringify({ action, ...params }))
  return true
}

export function __getSocketForTests() {
  return ws
}
