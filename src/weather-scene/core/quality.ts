import { QUALITY_TIERS, type QualityTier } from "../../weather/sceneParams";

// Per-tier budgets; PerformanceMonitor steps the tier down to "potato" (flat cloud
// deck). Particle counts are simultaneous maxima at full intensity: emission rate
// = count × intensity / mean life.

export interface VolumetricBudget {
  /** Cloud render-target size relative to the canvas (per axis). */
  scale: number;
  /** Lit (expensive) samples per ray — the adaptive march's cap; empty air is crossed cheaply. */
  steps: number;
  /** Steps towards the light per sample. */
  lightSteps: number;
  /** Edge length of the 3D noise texture. */
  noiseSize: number;
  /** Rays stop here (m); beyond it clouds have faded into the haze. */
  maxDistance: number;
  /** Samples per pixel of the god-ray pass (radial march towards the sun). */
  raySamples: number;
}

export interface QualityBudget {
  dprMax: number;
  fps: number;
  /** null → flat CloudDeck fallback. */
  volumetric: VolumetricBudget | null;
  rain: number;
  snow: number;
  hail: number;
  stars: number;
  sparkles: number;
}

export const QUALITY: Record<QualityTier, QualityBudget> = {
  high: {
    dprMax: 1.5,
    fps: 60,
    volumetric: { scale: 0.5, steps: 64, lightSteps: 6, noiseSize: 128, maxDistance: 60000, raySamples: 32 },
    rain: 1800,
    snow: 1100,
    hail: 260,
    stars: 1600,
    sparkles: 320,
  },
  medium: {
    dprMax: 1.25,
    fps: 60,
    volumetric: { scale: 0.4, steps: 48, lightSteps: 5, noiseSize: 96, maxDistance: 50000, raySamples: 24 },
    rain: 1000,
    snow: 650,
    hail: 150,
    stars: 1000,
    sparkles: 180,
  },
  low: {
    dprMax: 1,
    fps: 30,
    volumetric: { scale: 0.33, steps: 32, lightSteps: 4, noiseSize: 64, maxDistance: 40000, raySamples: 16 },
    rain: 450,
    snow: 300,
    hail: 80,
    stars: 500,
    sparkles: 90,
  },
  potato: {
    dprMax: 1,
    fps: 30,
    volumetric: null,
    rain: 300,
    snow: 200,
    hail: 60,
    stars: 400,
    sparkles: 60,
  },
};

/** GLSL loop bound for the light march (loops need a constant bound). */
export const MAX_LIGHT_STEPS = Math.max(
  ...Object.values(QUALITY).map((b) => b.volumetric?.lightSteps ?? 0),
);

export function initialTier(isMobile: boolean): QualityTier {
  return isMobile ? "low" : "high";
}

export function lowerTier(tier: QualityTier): QualityTier {
  return QUALITY_TIERS[Math.max(0, QUALITY_TIERS.indexOf(tier) - 1)];
}

/** GLSL loop bound for the god-ray march. */
export const MAX_RAY_SAMPLES = Math.max(
  ...Object.values(QUALITY).map((b) => b.volumetric?.raySamples ?? 0),
);
