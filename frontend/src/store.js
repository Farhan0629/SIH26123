import { create } from 'zustand'
const useStore = create((set) => ({
  connected: false, connectionState: 'disconnected', connectionError: null,
  warehouse: null, robots: [], tick: 0, sceneEpoch: 0,
  tasks: { pending: [], active: [], completed: [], completed_count: 0, total_count: 0 },
  metrics: { collisions: 0, tasks_completed: 0, avg_completion_ticks: 0, baseline_avg_ticks: 0, improvement_pct: 0, episode_ticks: 0 },
  p2pMessages: [], events: [], sim: { running: false, paused: false, speed: 0.5 },
  cameraMode: 'overview', cameraRevision: 0, followRobotId: null, selectedRobotId: null, focusTarget: null,
  showRoutes: false, showP2P: false, shelfView: 'lowRack', reducedMotion: false,
  lastUpdateTime: Date.now(),
  setConnected: (connected) => set({ connected, connectionState: connected ? 'connected' : 'disconnected', connectionError: null }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setConnectionError: (connectionError) => set({ connectionError, connectionState: 'error', connected: false }),
  updateState: (data) => set((state) => {
    const robots = data.robots ?? state.robots
    const reset = typeof data.tick === 'number' && data.tick < state.tick
    return { robots, tasks: data.tasks ?? state.tasks, metrics: data.metrics ?? state.metrics, p2pMessages: data.p2p_messages ?? state.p2pMessages, events: data.events ?? state.events, sim: data.sim ?? state.sim, tick: data.tick ?? state.tick, sceneEpoch: state.sceneEpoch + (reset ? 1 : 0), selectedRobotId: robots.some((r) => r.id === state.selectedRobotId) ? state.selectedRobotId : robots[0]?.id ?? null, lastUpdateTime: Date.now() }
  }),
  setWarehouse: (warehouse) => set({ warehouse }),
  setCameraMode: (cameraMode) => set((s) => ({ cameraMode, cameraRevision: s.cameraRevision + 1 })),
  setFollowRobot: (id) => set((s) => ({ selectedRobotId: id, followRobotId: id, cameraMode: 'follow', cameraRevision: s.cameraRevision + 1 })),
  setFocusTarget: (focusTarget) => set((s) => ({ focusTarget, cameraMode: 'focus', cameraRevision: s.cameraRevision + 1 })),
  selectRobot: (id) => set({ selectedRobotId: id, followRobotId: id }),
  setShowRoutes: (showRoutes) => set({ showRoutes }), setShowP2P: (showP2P) => set({ showP2P }),
  setShelfView: (shelfView) => set({ shelfView }), setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}))
export default useStore
