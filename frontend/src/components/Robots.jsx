import useStore from '../store'
import Robot from './Robot'
import P2PLines from './P2PLines'

export default function Robots() {
  const robots = useStore((s) => s.robots)
  
  return (
    <group>
      {robots.map((robot) => (
        <Robot key={robot.id} robot={robot} />
      ))}
      <P2PLines />
    </group>
  )
}
