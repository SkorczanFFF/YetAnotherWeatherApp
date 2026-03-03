import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";

/** FogExp2; min density so fog is always slightly visible. */
const FOG_COLOR_BY_TIME: Record<string, number> = {
  day: 0x6FACC9,
  dawn: 0xf79c5b,
  dusk: 0xf2bb93,
  night: 0xa9bec9,
};
const FOG_COLOR_THUNDERSTORM = 0x2A3542;

const FOG_DENSITY_MIN = 0.02;

interface FogEffectProps {
  config: SimulationConfig;
}

export function FogEffect({ config }: FogEffectProps) {
  const fogRef = useRef<THREE.FogExp2 | null>(null);

  useFrame((state) => {
    const scene = state.scene;
    const weatherDensity = config.fogDensity ?? 0;
    const density = Math.max(weatherDensity, FOG_DENSITY_MIN);
    const fogColor = config.thunderstorm
      ? FOG_COLOR_THUNDERSTORM
      : (FOG_COLOR_BY_TIME[config.timeOfDay] ?? FOG_COLOR_BY_TIME.day);
    if (!fogRef.current) {
      fogRef.current = new THREE.FogExp2(
        new THREE.Color(fogColor),
        density,
      );
    }
    fogRef.current.density = density;
    fogRef.current.color.setHex(fogColor);
    scene.fog = fogRef.current;
  });

  return null;
}
