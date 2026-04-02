import { useFrame } from "@react-three/fiber";

const PARALLAX = 2;

interface CameraRigProps {
  parallaxAmount: number;
}

export function CameraRig({ parallaxAmount }: CameraRigProps) {
  useFrame((state) => {
    const camera = state.camera;
    const pointer = state.pointer;
    camera.position.x = pointer.x * parallaxAmount * PARALLAX;
    camera.position.y = pointer.y * parallaxAmount * PARALLAX;
    camera.position.z = 5;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
  });

  return null;
}
