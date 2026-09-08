import { create } from 'zustand'

/*
 * Central state store. WebSocket client writes here, all components read from here.
 * Robot positions include prev_x/prev_y for smooth interpolation.
 */
const useStore = create((set) => ({
  // Connection state
  connected: false,
  connectionState: 'disconnected',
  connectionError: null,
  
  // Warehouse layout (set once on init)
  warehouse: null,        // { width, height, grid, blocked }
  
  // Robot states (updated every tick from WebSocket)
  robots: [],             // array of robot objects from backend
  
  // Task state
  tasks: { pending: [], active: [], completed_count: 0, total_count: 0 },
  
  // Metrics
  metrics: {
    collisions: 0,
    tasks_completed: 0,
    avg_completion_ticks: 0,
    baseline_avg_ticks: 0,
    improvement_pct: 0,
    episode_ticks: 0,
  },
  
  // P2P message log (for visualizing connections)
  p2pMessages: [],
  
  // Real-time fleet decision and activity events
  events: [],
  
  // Simulation control
  sim: { running: false, paused: false, speed: 1.0 },
  
  // Camera mode
  cameraMode: 'overview',     // 'overview' | 'orbit' | 'topdown' | 'follow' | 'focus' | 'receiving' | 'dispatch'
  followRobotId: null,
  focusTarget: null,       // [x, y, z] to frame
  selectedRobotId: null,
  showRoutes: false,
  showP2P: false,
  shelfView: 'solid',      // 'solid' | 'xray' | 'lowRack'
  reducedMotion: false,
  
  // Last update timestamp (for interpolation)
  lastUpdateTime: Date.now(),
  
  // Actions
  setConnected: (val) => set({
    connected: val,
    connectionState: val ? 'connected' : 'disconnected',
    connectionError: val ? null : null,
  }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setConnectionError: (connectionError) => set({ connectionError, connectionState: 'error', connected: false }),
  
  updateState: (data) => set((state) => ({
    robots: data.robots || [],
    tasks: data.tasks || state.tasks,
    metrics: data.metrics || state.metrics,
    p2pMessages: data.p2p_messages || [],
    events: data.events || state.events,
    sim: data.sim || state.sim,
    lastUpdateTime: Date.now(),
  })),
  
  setWarehouse: (wh) => set({ warehouse: wh }),
  
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setFollowRobot: (id) => set({ followRobotId: id, cameraMode: 'follow' }),
  setFocusTarget: (target) => set({ focusTarget: target, cameraMode: 'focus' }),
  selectRobot: (id) => set({ selectedRobotId: id }),
  setShowRoutes: (showRoutes) => set({ showRoutes }),
  setShowP2P: (showP2P) => set({ showP2P }),
  setShelfView: (shelfView) => set({ shelfView }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}))

export default useStore
