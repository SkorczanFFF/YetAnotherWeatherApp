import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { CAMERA_PITCH, LOOK_DISTANCE, PARALLAX_RANGE } from "./worldFrame";

const SMOOTH = 0.08;

/** Fixed look target — the base view is static; parallax only nudges the eye. */
const LOOK_TARGET = new Vector3(
  0,
  Math.tan(CAMERA_PITCH) * LOOK_DISTANCE,
  -LOOK_DISTANCE,
);

interface CameraRigProps {
  parallaxAmount: number;
}

/**
 * Static camera at the origin, pitched up towards LOOK_TARGET. Pointer (desktop)
 * or device tilt (mobile) translates the eye by up to PARALLAX_RANGE ×
 * parallaxAmount; view volumes are padded for exactly this range.
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

    const range = parallaxAmount * PARALLAX_RANGE;
    const camera = state.camera;
    camera.position.set(smoothX.current * range, smoothY.current * range, 0);
    camera.lookAt(LOOK_TARGET);
    camera.updateMatrixWorld(true);
  });

  return null;
}
