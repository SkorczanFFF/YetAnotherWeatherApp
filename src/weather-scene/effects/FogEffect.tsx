/**
 * Scene fog (FogExp2) with time-of-day color. Sets scene.fog so all
 * fog-supporting materials fade into the fog color at distance. The
 * visible fog volume itself comes from MistEffect.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import { getFogColor } from "./internal/effectColors";

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
    const fogColor = getFogColor(config.timeOfDay, config.thunderstorm);
    if (!fogRef.current) {
      fogRef.current = new THREE.FogExp2(new THREE.Color(fogColor), density);
    }
    fogRef.current.density = density;
    fogRef.current.color.setHex(fogColor);
    scene.fog = fogRef.current;
  });

  return null;
}
