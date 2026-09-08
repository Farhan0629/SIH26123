import useStore from '../store'
import Robot from './Robot'
import P2PLines from './P2PLines'
export default function Robots() {
  const robots = useStore((s) => s.robots)
  const selected = useStore((s) => s.selectedRobotId)
  const select = useStore((s) => s.selectRobot)
  const p2p = useStore((s) => s.showP2P)
  const epoch = useStore((s) => s.sceneEpoch)
  return <group>{robots.map((r) => <Robot key={`${epoch}:${r.id}`} robot={r} selected={selected === r.id} onSelect={select} />)}{p2p && <P2PLines />}</group>
}
