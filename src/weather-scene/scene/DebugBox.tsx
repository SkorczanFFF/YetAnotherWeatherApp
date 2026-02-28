export interface DebugBoxPosition {
  x: number;
  y: number;
  z: number;
}

interface DebugBoxProps {
  position: DebugBoxPosition;
}

const SIZE = 1;

export function DebugBox({ position }: DebugBoxProps) {
  return (
    <mesh position={[position.x, position.y, position.z]}>
      <boxGeometry args={[SIZE, SIZE, SIZE]} />
      <meshBasicMaterial
        color={0xff6600}
        wireframe
        depthTest={true}
      />
    </mesh>
  );
}
