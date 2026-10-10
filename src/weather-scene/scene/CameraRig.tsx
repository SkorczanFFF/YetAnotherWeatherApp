import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { useDeviceOrientation } from "./useDeviceOrientation";

const PARALLAX = 1.5;
const SMOOTH = 0.08;

interface CameraRigProps {
  parallaxAmount: number;
}

/**
 * Pointer/gyro parallax rig. The camera always looks at the world origin
 * where the single box sits. Mouse or device tilt nudges the camera's
 * x/y on a small range so the box gets a subtle parallax motion.
 */
export function CameraRig({ parallaxAmount }: CameraRigProps) {
  const orientation = useDeviceOrientation();
  const smoothX = useRef(0);
  const smoothY = useRef(0);

  useFrame((state) => {
    const gyro = orientation.current;
    const inputX = gyro.available ? gyro.x : state.pointer.x;
    const inputY = gyro.available ? gyro.y : state.pointer.y;

    smoothX.current = MathUtils.lerp(smoothX.current, inputX, SMOOTH);
    smoothY.current = MathUtils.lerp(smoothY.current, inputY, SMOOTH);

    const camera = state.camera;
    camera.position.x = smoothX.current * parallaxAmount * PARALLAX;
    camera.position.y = smoothY.current * parallaxAmount * PARALLAX;
    camera.position.z = 5;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
  });

  return null;
}
