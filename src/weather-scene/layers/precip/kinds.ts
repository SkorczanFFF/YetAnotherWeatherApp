// Precipitation kinds: what each particle system is built from (fixed) and
// what the weather sets on it (rates, fall speeds, colour, sway). Pure.

import type { Texture } from "three";
import { RenderMode } from "three.quarks";
import type { SceneParams } from "../../../weather/sceneParams";
import { clamp01 } from "../../../utils/math";
import type { QualityBudget } from "../../core/quality";
import type { PrecipVolume, ViewFrame } from "../../core/viewVolume";
import { getDotTexture, getSnowAtlas, SNOW_TILES } from "./textures";

export type Kind = "drizzle" | "rain" | "grains" | "snow" | "wet-snow" | "hail";

/** What a particle system is built from — fixed per kind. */
export interface KindDef {
  mode: RenderMode;
  texture: () => Texture;
  volume: PrecipVolume;
  windFactor: number;
  sizeMin: number;
  sizeMax: number;
  /** Fall speed range, scene units/s (rain raises it with the rate). */
  fall: [number, number];
  /** Stretched billboards: streak length = |velocity| × stretch × size. */
  stretch?: number;
  tiles?: number;
}

// Streaks start further out than flakes: a drop 1.5 units away stretched
// across ~30° of the frame as one long white slash.
const RAIN_VOLUME: PrecipVolume = { dNear: 3, dFar: 40, pad: 1.5 };
const SNOW_VOLUME: PrecipVolume = { dNear: 1.5, dFar: 30, pad: 1 };
const HAIL_VOLUME: PrecipVolume = { dNear: 3, dFar: 30, pad: 1 };

export const KINDS: Record<Kind, KindDef> = {
  drizzle: {
    mode: RenderMode.StretchedBillBoard, texture: getDotTexture, volume: RAIN_VOLUME,
    windFactor: 0.9, sizeMin: 0.016, sizeMax: 0.024, fall: [6.5, 9], stretch: 0.9,
  },
  rain: {
    mode: RenderMode.StretchedBillBoard, texture: getDotTexture, volume: RAIN_VOLUME,
    windFactor: 0.7, sizeMin: 0.03, sizeMax: 0.045, fall: [14, 20], stretch: 1.1,
  },
  grains: {
    mode: RenderMode.BillBoard, texture: getDotTexture, volume: SNOW_VOLUME,
    windFactor: 0.5, sizeMin: 0.05, sizeMax: 0.08, fall: [3.5, 5],
  },
  snow: {
    mode: RenderMode.BillBoard, texture: getSnowAtlas, volume: SNOW_VOLUME,
    windFactor: 0.55, sizeMin: 0.16, sizeMax: 0.3, fall: [1.1, 2], tiles: SNOW_TILES,
  },
  // Wet flakes: smaller and faster.
  "wet-snow": {
    mode: RenderMode.BillBoard, texture: getSnowAtlas, volume: SNOW_VOLUME,
    windFactor: 0.55, sizeMin: 0.12, sizeMax: 0.2, fall: [2.6, 3.6], tiles: SNOW_TILES,
  },
  // Short streaks — hail is fast enough to blur.
  hail: {
    mode: RenderMode.StretchedBillBoard, texture: getDotTexture, volume: HAIL_VOLUME,
    windFactor: 0.4, sizeMin: 0.07, sizeMax: 0.12, fall: [22, 28], stretch: 0.3,
  },
};

/** What changes with the weather — applied to the live system every frame. */
export interface SystemSpec {
  kind: Kind;
  /** Simultaneous particles at full intensity. */
  max: number;
  /** 0..1 — scales emission. */
  intensity: number;
  fallMin: number;
  fallMax: number;
  color: [number, number, number, number];
  /** Sway amplitude (scene units) for snow. */
  sway?: number;
}

export function buildSpecs(params: SceneParams, budget: QualityBudget): SystemSpec[] {
  const { precip, wind } = params;
  const specs: SystemSpec[] = [];
  const sleet = precip.rainMmH > 0 && precip.snowCmH > 0;
  const fall = (kind: Kind) => ({ fallMin: KINDS[kind].fall[0], fallMax: KINDS[kind].fall[1] });

  if (precip.rainMmH > 0) {
    const r = precip.rainMmH;
    const color: SystemSpec["color"] = precip.freezing
      ? [0.92, 0.96, 1.0, 0.6]
      : [0.84, 0.89, 0.96, precip.drizzle ? 0.4 : 0.5];
    specs.push(
      precip.drizzle
        ? {
            kind: "drizzle",
            max: budget.rain,
            intensity: clamp01(0.35 + (r / 1.5) * 0.65) * (sleet ? 0.6 : 1),
            ...fall("drizzle"),
            color,
          }
        : {
            kind: "rain",
            max: budget.rain,
            intensity: clamp01(Math.pow(r / 10, 0.6) + 0.06) * (sleet ? 0.6 : 1),
            // Heavier rain, bigger and faster drops.
            fallMin: KINDS.rain.fall[0] + Math.min(r, 20) * 0.2,
            fallMax: KINDS.rain.fall[1] + Math.min(r, 20) * 0.25,
            color,
          },
    );
  }

  if (precip.snowCmH > 0) {
    const intensity = clamp01(Math.pow(precip.snowCmH / 3, 0.6) + 0.06);
    if (precip.grains) {
      specs.push({ kind: "grains", max: budget.snow, intensity, ...fall("grains"), color: [0.94, 0.96, 1, 0.85] });
    } else {
      const kind = sleet ? "wet-snow" : "snow";
      specs.push({
        kind,
        max: budget.snow,
        intensity: sleet ? intensity * 0.7 : intensity,
        ...fall(kind),
        color: [1, 1, 1, 0.95],
        sway: 0.3 + Math.min(wind.speedMs, 20) * 0.03,
      });
    }
  }

  if (precip.hail) {
    specs.push({ kind: "hail", max: budget.hail, intensity: 0.6, ...fall("hail"), color: [0.97, 0.98, 1, 1] });
  }
  return specs;
}

/** Initial guess for the mean particle life (calm air) — the emitter refines it as it spawns. */
export function initialMeanLife(frame: ViewFrame, spec: SystemSpec): number {
  const { dNear, dFar, pad } = KINDS[spec.kind].volume;
  // Mean distance of points uniform in the trapezoid (density ∝ d).
  const dMean = ((2 / 3) * (dFar ** 3 - dNear ** 3)) / (dFar ** 2 - dNear ** 2);
  const span = (frame.tanTop - frame.tanBottom) * dMean + 2 * pad;
  return span / ((spec.fallMin + spec.fallMax) / 2);
}
