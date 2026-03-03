import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";
import {
  getSkyTexture,
  getStormSkyTexture,
} from "./skyTextures";

interface SkyBackgroundProps {
  config: SimulationConfig;
}

const stormBackgrounds = new Map<string, THREE.Texture | THREE.Color>();

function getStormBackground(phase: string): THREE.Texture | THREE.Color {
  let bg = stormBackgrounds.get(phase);
  if (!bg) {
    bg = getStormSkyTexture(phase);
    stormBackgrounds.set(phase, bg);
  }
  return bg;
}

export function SkyBackground({ config }: SkyBackgroundProps) {
  useFrame((state) => {
    const scn = state.scene;
    if (config.thunderstorm) {
      scn.background = getStormBackground(config.timeOfDay);
    } else {
      scn.background = getSkyTexture(config.timeOfDay);
    }
  });

  return null;
}
