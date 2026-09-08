import useStore from './store'

let ws = null
let reconnectTimer = null

export function connectWebSocket() {
  const host = window.location.hostname || 'localhost'
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${wsProtocol}//${host}:8000/ws`
  
  try {
    ws = new WebSocket(wsUrl)
  } catch (e) {
    console.error('Failed to create WebSocket:', e)
    reconnectTimer = setTimeout(connectWebSocket, 2000)
    return
  }
  
  ws.onopen = () => {
    console.log('WebSocket connected')
    useStore.getState().setConnected(true)
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      
      if (data.type === 'init') {
        useStore.getState().setWarehouse(data.warehouse)
        useStore.getState().updateState({
          robots: data.robots,
          tasks: { pending: [], active: [], completed_count: 0, total_count: 0 },
          metrics: useStore.getState().metrics,
          p2p_messages: [],
          sim: { running: false, paused: false, speed: 1.0 },
        })
      } else if (data.type === 'state_update') {
        if (data.warehouse) {
          useStore.getState().setWarehouse(data.warehouse)
        }
        useStore.getState().updateState(data)
      }
    } catch (err) {
      console.error('Error parsing message:', err)
    }
  }
  
  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting in 2s...')
    useStore.getState().setConnected(false)
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(connectWebSocket, 2000)
    }
  }
  
  ws.onerror = (err) => {
    console.error('WebSocket error:', err)
    if (ws) {
      ws.close()
    }
  }
}

export function sendCommand(action, params = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action, ...params }))
  }
}
