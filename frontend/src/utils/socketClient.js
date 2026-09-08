// Dependency-injected transport: no UI dependency and no stale-socket callbacks.
export function createSocketClient({ getUrl, Socket, onConnection, onMessage, onWarning, later = setTimeout, cancel = clearTimeout }) {
  let socket = null, timer = null, consumers = 0
  const stopTimer = () => { if (timer !== null) { cancel(timer); timer = null } }
  const retry = () => { if (consumers && timer === null) timer = later(() => { timer = null; open() }, 2000) }
  function open() {
    if (!consumers || socket) return
    onConnection('connecting')
    let current
    try { current = new Socket(getUrl()) } catch { onConnection('disconnected'); onWarning('Could not connect to the simulation server. Retrying.'); retry(); return }
    socket = current
    current.onopen = () => { if (socket !== current) return; stopTimer(); onConnection('connected') }
    current.onmessage = (event) => {
      if (socket !== current) return
      try {
        const data = JSON.parse(event.data)
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid envelope')
        if (data.type === 'command_error') { onWarning(data.message || 'Command rejected'); return }
        if (data.type !== 'init' && data.type !== 'state_update') return
        if (!Array.isArray(data.robots)) throw new Error('Missing robot states')
        onMessage(data)
      } catch { onWarning('An invalid server update was ignored. The connection remains open.') }
    }
    current.onclose = () => { if (socket !== current) return; socket = null; onConnection('disconnected'); retry() }
    current.onerror = () => { if (socket === current) { onWarning('Connection interrupted. Retrying.'); current.close() } }
  }
  return {
    connect() {
      consumers++; open()
      let cleaned = false
      return () => {
        if (cleaned) return; cleaned = true
        consumers--
        if (consumers) return
        stopTimer()
        const old = socket; socket = null
        if (old) { old.onopen = old.onmessage = old.onerror = old.onclose = null; old.close() }
        onConnection('disconnected')
      }
    },
    send(action, params = {}) {
      if (!socket || socket.readyState !== Socket.OPEN) return false
      try { socket.send(JSON.stringify({ ...params, action })); return true } catch { socket.close(); return false }
    },
    getSocket: () => socket,
  }
}
