import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SPEED = 4;

type Keys = { w: boolean; a: boolean; s: boolean; d: boolean };
const keyMap: Record<string, keyof Keys> = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
};

export function FreeCameraWASD() {
  const keysRef = useRef<Keys>({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = keyMap[e.code];
      if (k) {
        e.preventDefault();
        keysRef.current[k] = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = keyMap[e.code];
      if (k) {
        keysRef.current[k] = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keysRef.current.w = false;
      keysRef.current.a = false;
      keysRef.current.s = false;
      keysRef.current.d = false;
    };
  }, []);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const k = keysRef.current;
    if (!k.w && !k.a && !k.s && !k.d) return;

    const camera = state.camera;
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current
      .set(-forward.current.z, 0, forward.current.x)
      .normalize();

    const move = SPEED * delta;
    if (k.w) camera.position.addScaledVector(forward.current, move);
    if (k.s) camera.position.addScaledVector(forward.current, -move);
    if (k.d) camera.position.addScaledVector(right.current, move);
    if (k.a) camera.position.addScaledVector(right.current, -move);
    camera.updateMatrixWorld(true);
  });

  return null;
}
