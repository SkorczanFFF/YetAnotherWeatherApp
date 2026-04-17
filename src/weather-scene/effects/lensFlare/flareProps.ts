import { Color } from "three";
import type { SimulationConfig, TimeOfDay } from "../../types";

const SUN_COLOR_WARM = new Color(0xffb347);
const SUN_COLOR_WHITE = new Color(0xfff5e6);
const MOON_COLOR_COOL = new Color(0.75, 0.85, 1.0);

export interface SunFlareProps {
  colorGain: Color;
  glareSize: number;
  flareSize: number;
  starPoints: number;
  flareSpeed: number;
  anamorphic: boolean;
  secondaryGhosts: boolean;
  starBurst: boolean;
  animated: boolean;
  haloScale: number;
  ghostScale: number;
}

export interface MoonFlareProps {
  colorGain: Color;
  glareSize: number;
  flareSize: number;
  starPoints: number;
  anamorphic: boolean;
  secondaryGhosts: boolean;
  starBurst: boolean;
  animated: boolean;
  flareSpeed: number;
  haloScale: number;
  ghostScale: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function buildSunFlareProps(config: SimulationConfig): SunFlareProps {
  const cover = config.cloudCover ?? 0;
  const overcastMix = smoothstep(0.3, 0.8, cover);
  const colorGain = SUN_COLOR_WARM.clone().lerp(SUN_COLOR_WHITE, overcastMix);
  const thunder = config.thunderstorm;
  // Halo + glare here are screen-space multipliers in the LensFlareEffect
  // shader. The previous values (haloScale 0.8, glareSize 0.35) produced a
  // halo large enough to wash most of the screen with warm additive colour,
  // which — together with the dusk sky — read as a dark orange/brown overlay.
  // Keep them modest so the flare reads as a crisp element rather than a
  // tint pass.
  return {
    colorGain,
    glareSize: thunder ? 0.08 : 0.14,
    flareSize: 0.004,
    starPoints: 6,
    flareSpeed: 0.4,
    anamorphic: false,
    secondaryGhosts: true,
    starBurst: true,
    animated: true,
    haloScale: 0.25,
    ghostScale: 0.06,
  };
}

export function buildMoonFlareProps(): MoonFlareProps {
  return {
    colorGain: MOON_COLOR_COOL.clone(),
    glareSize: 0.06,
    flareSize: 0.002,
    starPoints: 0,
    anamorphic: false,
    secondaryGhosts: false,
    starBurst: false,
    animated: false,
    flareSpeed: 0,
    haloScale: 0.15,
    ghostScale: 0.02,
  };
}

export interface TimeGates {
  sunVisible: number;
  moonVisible: number;
}

export function getTimeGates(timeOfDay: TimeOfDay, thunderstorm: boolean): TimeGates {
  const day = timeOfDay === "day" || timeOfDay === "dawn" || timeOfDay === "dusk";
  const night = timeOfDay === "night";
  const stormGate = thunderstorm ? 0 : 1;
  return {
    sunVisible: day ? stormGate : 0,
    moonVisible: night ? stormGate : 0,
  };
}
