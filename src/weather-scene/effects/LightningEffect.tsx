import { useFrame } from "@react-three/fiber";
import { useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";

const FLASH_DURATION = 0.12;
const FLASH_OPACITY_MIN = 0.5;
const FLASH_OPACITY_MAX = 1;
const DOUBLE_FLASH_CHANCE = 0.25;
const DOUBLE_FLASH_DELAY_MIN = 0.2;
const DOUBLE_FLASH_DELAY_MAX = 0.5;

const FLASH_INTERVALS: Record<string, [number, number]> = {
  light: [5, 7],
  moderate: [4, 5],
  heavy: [2, 3],
};

interface LightningEffectProps {
  config: SimulationConfig;
}

export function LightningEffect({ config }: LightningEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const nextFlashRef = useRef(0);
  const flashEndRef = useRef(0);
  const currentFlashOpacityRef = useRef(FLASH_OPACITY_MIN);
  const pendingSecondFlashRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const mat = matRef.current;
    if (mat) {
      mat.transparent = true;
      mat.depthTest = false;
      mat.opacity = 0;
    }
  }, []);

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;

    if (!config.thunderstorm) {
      mat.opacity = 0;
      pendingSecondFlashRef.current = null;
      return;
    }

    const t = state.clock.elapsedTime;

    if (pendingSecondFlashRef.current != null && t >= pendingSecondFlashRef.current) {
      pendingSecondFlashRef.current = null;
      currentFlashOpacityRef.current =
        FLASH_OPACITY_MIN + Math.random() * (FLASH_OPACITY_MAX - FLASH_OPACITY_MIN);
      flashEndRef.current = t + FLASH_DURATION;
    } else if (t >= nextFlashRef.current) {
      const [min, max] = FLASH_INTERVALS[config.intensity] ?? FLASH_INTERVALS.moderate;
      nextFlashRef.current = t + min + Math.random() * (max - min);
      currentFlashOpacityRef.current =
        FLASH_OPACITY_MIN + Math.random() * (FLASH_OPACITY_MAX - FLASH_OPACITY_MIN);
      flashEndRef.current = t + FLASH_DURATION;
      if (Math.random() < DOUBLE_FLASH_CHANCE) {
        const delay =
          DOUBLE_FLASH_DELAY_MIN +
          Math.random() * (DOUBLE_FLASH_DELAY_MAX - DOUBLE_FLASH_DELAY_MIN);
        pendingSecondFlashRef.current = t + FLASH_DURATION + delay;
      }
    }

    if (t < flashEndRef.current) {
      const progress = (flashEndRef.current - t) / FLASH_DURATION;
      mat.opacity = currentFlashOpacityRef.current * progress;
    } else {
      mat.opacity = 0;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={999}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial ref={matRef} color="#e8e0ff" />
    </mesh>
  );
}
