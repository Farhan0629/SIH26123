import test from 'node:test'
import assert from 'node:assert/strict'
import { createSocketClient } from './socketClient.js'
function setup() {
  const instances = [], connections = [], messages = [], warnings = [], timers = new Map()
  let next = 0
  class Socket {
    static OPEN = 1
    constructor() { this.readyState = 0; this.sent = []; instances.push(this) }
    close() { this.readyState = 3; this.onclose?.() }
    send(text) { this.sent.push(text) }
    open() { this.readyState = 1; this.onopen?.() }
  }
  const client = createSocketClient({ Socket, getUrl: () => 'ws://localhost:8000/ws', onConnection: (s) => connections.push(s), onMessage: (m) => messages.push(m), onWarning: (w) => warnings.push(w), later: (f) => { const id = ++next; timers.set(id, f); return id }, cancel: (id) => timers.delete(id) })
  return { client, instances, connections, messages, warnings, timers }
}
test('two consumers share a connection and cleanup is idempotent', () => {
  const f = setup(), a = f.client.connect(), b = f.client.connect()
  assert.equal(f.instances.length, 1)
  a(); a(); assert.equal(f.instances[0].readyState, 0)
  b(); assert.equal(f.client.getSocket(), null); assert.equal(f.timers.size, 0)
})
test('StrictMode setup-cleanup-setup cannot be disrupted by old callbacks', () => {
  const f = setup(), cleanup = f.client.connect(), stale = f.instances[0]
  const oldError = stale.onerror, oldClose = stale.onclose
  cleanup(); const cleanup2 = f.client.connect(); const fresh = f.instances[1]
  fresh.open(); oldError(); oldClose()
  assert.equal(f.client.getSocket(), fresh); assert.equal(fresh.readyState, 1)
  cleanup2()
})
test('disconnect schedules one reconnect and unmount cancels it', () => {
  const f = setup(), cleanup = f.client.connect()
  f.instances[0].open(); f.instances[0].close()
  assert.equal(f.timers.size, 1)
  cleanup(); assert.equal(f.timers.size, 0)
})
test('malformed frame is ignored without disabling an open connection', () => {
  const f = setup(), cleanup = f.client.connect(), s = f.instances[0]
  s.open(); s.onmessage({ data: 'null' }); s.onmessage({ data: '{bad' })
  s.onmessage({ data: JSON.stringify({ type: 'state_update', robots: [] }) })
  assert.equal(f.warnings.length, 2); assert.equal(f.messages.length, 1)
  assert.equal(f.connections.at(-1), 'connected'); cleanup()
})
test('commands are guarded and cannot override the requested action', () => {
  const f = setup(), cleanup = f.client.connect(), s = f.instances[0]
  assert.equal(f.client.send('pause'), false)
  s.open(); assert.equal(f.client.send('speed', { action: 'start', value: 0.5 }), true)
  assert.equal(JSON.parse(s.sent[0]).action, 'speed')
  cleanup(); assert.equal(f.client.send('pause'), false)
})
