import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";
import {
  getSkyTexture,
  SKY_COLORS,
  STORM_SKY_COLOR,
} from "./skyTextures";

const stormColor = new THREE.Color(STORM_SKY_COLOR);

interface SkyBackgroundProps {
  config: SimulationConfig;
}

export function SkyBackground({ config }: SkyBackgroundProps) {
  useFrame((state) => {
    const scn = state.scene;
    if (config.thunderstorm) {
      scn.background = stormColor;
    } else {
      scn.background = getSkyTexture(config.timeOfDay);
    }
  });

  return null;
}
