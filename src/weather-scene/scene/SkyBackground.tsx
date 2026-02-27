import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import {
  getDaySkyTexture,
  getNightSkyTexture,
  getDawnSkyTexture,
  getDuskSkyTexture,
  SKY_COLORS,
  STORM_SKY_COLOR,
} from "./skyTextures";

interface SkyBackgroundProps {
  config: SimulationConfig;
}

export function SkyBackground({ config }: SkyBackgroundProps) {
  useFrame((state) => {
    const scn = state.scene;
    const isDay =
      !config.thunderstorm && config.timeOfDay === "day";
    const isNight =
      !config.thunderstorm && config.timeOfDay === "night";
    const isDawn =
      !config.thunderstorm && config.timeOfDay === "dawn";
    const isDusk =
      !config.thunderstorm && config.timeOfDay === "dusk";
    if (isDay) {
      scn.background = getDaySkyTexture();
    } else if (isNight) {
      scn.background = getNightSkyTexture();
    } else if (isDawn) {
      scn.background = getDawnSkyTexture();
    } else if (isDusk) {
      scn.background = getDuskSkyTexture();
    } else {
      scn.background = new THREE.Color(
        config.thunderstorm
          ? STORM_SKY_COLOR
          : SKY_COLORS[config.timeOfDay] ?? SKY_COLORS.day,
      );
    }
  });

  return null;
}
