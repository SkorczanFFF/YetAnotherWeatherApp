import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";

const FOG_COLOR_BY_TIME: Record<string, number> = {
  day: 0xb0b4bc,
  dawn: 0xa89c90,
  dusk: 0xa89c90,
  night: 0x4a4c54,
};

interface FogEffectProps {
  config: SimulationConfig;
}

export function FogEffect({ config }: FogEffectProps) {
  const fogRef = useRef<THREE.FogExp2 | null>(null);

  useFrame((state) => {
    const scene = state.scene;
    const density = config.fogDensity ?? 0;
    if (density > 0) {
      const fogColor =
        FOG_COLOR_BY_TIME[config.timeOfDay] ?? FOG_COLOR_BY_TIME.day;
      if (!fogRef.current) {
        fogRef.current = new THREE.FogExp2(
          new THREE.Color(fogColor),
          density,
        );
      }
      fogRef.current.density = density;
      fogRef.current.color.setHex(fogColor);
      scene.fog = fogRef.current;
    } else {
      scene.fog = null;
    }
  });

  return null;
}
