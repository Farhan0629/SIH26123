import test from 'node:test'
import assert from 'node:assert/strict'
import { connectWebSocket, sendCommand, __getSocketForTests } from './websocket.js'

class MockWebSocket {
  static instances = []
  static OPEN = 1
  static CONNECTING = 0
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    this.sent = []
    this.closed = false
    MockWebSocket.instances.push(this)
  }

  send(message) {
    this.sent.push(message)
  }

  close() {
    this.closed = true
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose()
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) this.onopen()
  }
}

test.beforeEach(() => {
  MockWebSocket.instances = []
  globalThis.WebSocket = MockWebSocket
  globalThis.window = {
    location: { hostname: 'localhost', protocol: 'http:' },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  }
})

test.afterEach(() => {
  delete globalThis.WebSocket
  delete globalThis.window
})

test('connectWebSocket is StrictMode-safe with shared singleton socket', () => {
  const cleanupA = connectWebSocket()
  const cleanupB = connectWebSocket()

  assert.equal(MockWebSocket.instances.length, 1)

  MockWebSocket.instances[0].triggerOpen()
  const ok = sendCommand('speed', { value: 0.5 })

  assert.equal(ok, true)
  assert.equal(MockWebSocket.instances[0].sent.length, 1)

  cleanupA()
  assert.equal(MockWebSocket.instances[0].closed, false)

  cleanupB()
  assert.equal(MockWebSocket.instances[0].closed, true)
  assert.equal(__getSocketForTests(), null)
})

test('sendCommand returns false when socket is closed', () => {
  const cleanup = connectWebSocket()
  const socket = MockWebSocket.instances[0]
  socket.triggerOpen()
  socket.close()
  assert.equal(sendCommand('pause'), false)
  cleanup()
})
