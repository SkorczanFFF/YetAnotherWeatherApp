import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";

const AMBIENT_NORMAL = 0.35;
const AMBIENT_FLASH = 1.8;
const FLASH_DURATION = 0.12;
const MIN_INTERVAL = 2;
const MAX_INTERVAL = 5;

interface LightningEffectProps {
  config: SimulationConfig;
}

export function LightningEffect({ config }: LightningEffectProps) {
  const lightRef = useRef<THREE.AmbientLight>(null);
  const nextFlashRef = useRef(0);
  const flashEndRef = useRef(0);

  useFrame((state) => {
    const light = lightRef.current;
    if (!light) return;

    if (!config.thunderstorm) {
      light.intensity = AMBIENT_NORMAL;
      return;
    }

    const t = state.clock.elapsedTime;

    if (t >= nextFlashRef.current) {
      nextFlashRef.current = t + MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
      flashEndRef.current = t + FLASH_DURATION;
    }

    if (t < flashEndRef.current) {
      light.intensity = AMBIENT_FLASH;
    } else {
      light.intensity = AMBIENT_NORMAL;
    }
  });

  return (
    <ambientLight ref={lightRef} intensity={AMBIENT_NORMAL} />
  );
}
