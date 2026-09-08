import { Component, useEffect, useState } from 'react'
import { connectWebSocket } from './websocket'
import useStore from './store'
import Scene from './components/Scene'
import Dashboard from './dashboard/Dashboard'
class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="scene-message" role="alert"><h2>3D view unavailable</h2><p>The live controls and task panels still work. Try a browser with WebGL enabled.</p><button onClick={() => this.setState({ failed: false })}>Retry 3D view</button></div>
    return this.props.children
  }
}
export default function App() {
  const connected = useStore((s) => s.connected)
  const connectionError = useStore((s) => s.connectionError)
  const setReduced = useStore((s) => s.setReducedMotion)
  const sim = useStore((s) => s.sim)
  const [help, setHelp] = useState(true)
  useEffect(() => connectWebSocket(), [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(media.matches)
    apply(); media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [setReduced])
  return <div className="demo-shell">
    <header className="demo-header">
      <div><p className="eyebrow">SIH 26123 · Warehouse intelligence</p><h1>Fleet in motion<span>Digital twin</span></h1></div>
      <div className={`connection-badge ${connected ? 'online' : ''}`} role="status"><span aria-hidden="true">●</span> {connected ? (sim.running ? sim.paused ? 'Connected · Paused' : 'Connected · Running' : 'Connected · Ready') : 'Offline · Reconnecting'}</div>
    </header>
    <main className="demo-layout">
      <section className="demo-viewport" aria-label="Interactive warehouse digital twin">
        <SceneBoundary><Scene /></SceneBoundary>
        {help && <div className="watch-guide"><div><strong>Watch a package move</strong><p>Start the demo. Select a unit, then choose Follow. Watch it reach, lift, carry, and place the labeled carton.</p></div><button aria-label="Dismiss viewing guide" onClick={() => setHelp(false)}>×</button></div>}
        {connectionError && connected && <div className="connection-notice" role="status">{connectionError}</div>}
        {!connected && <div className="connection-notice" role="status">{connectionError || 'Waiting for the simulation server on port 8000. No live values are fabricated.'}</div>}
        <div className="viewport-caption"><span>RECEIVE → PICK UP → TRANSPORT → DELIVER</span><span>Drag to orbit · Scroll to zoom</span></div>
      </section>
      <aside className="demo-dashboard" aria-label="Fleet controls and telemetry"><Dashboard /></aside>
    </main>
  </div>
}
