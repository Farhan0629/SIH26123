import useStore from '../store'
import Robot from './Robot'
import P2PLines from './P2PLines'

export default function Robots() {
  const robots = useStore((s) => s.robots)
  const selectedRobotId = useStore((s) => s.selectedRobotId)
  const selectRobot = useStore((s) => s.selectRobot)
  const showP2P = useStore((s) => s.showP2P)
  
  return (
    <group>
      {robots.map((robot) => (
        <Robot
          key={robot.id}
          robot={robot}
          selected={selectedRobotId === robot.id}
          onSelect={selectRobot}
        />
      ))}
      {showP2P && <P2PLines />}
    </group>
  )
}
