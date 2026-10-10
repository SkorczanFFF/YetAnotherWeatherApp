import type { QualityTier } from "../../weather/sceneParams";

// Per-tier budgets. The initial tier comes from useIsMobile; drei's
// <PerformanceMonitor> steps it down when the frame rate can't hold the cap.
// Particle counts are the simultaneous maximum at full intensity — emission
// rates derive from them (count × intensity / lifetime).

export interface QualityBudget {
  dprMax: number;
  fps: number;
  antialias: boolean;
  cumulusClouds: number;
  /** Sprites per cloud — clouds × segments is the <Clouds limit>. */
  cumulusSegments: number;
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
    antialias: true,
    cumulusClouds: 10,
    cumulusSegments: 8,
    rain: 1800,
    snow: 1100,
    hail: 260,
    stars: 1600,
    sparkles: 320,
  },
  medium: {
    dprMax: 1.25,
    fps: 60,
    antialias: true,
    cumulusClouds: 7,
    cumulusSegments: 7,
    rain: 1000,
    snow: 650,
    hail: 150,
    stars: 1000,
    sparkles: 180,
  },
  low: {
    dprMax: 1,
    fps: 30,
    antialias: false,
    cumulusClouds: 4,
    cumulusSegments: 6,
    rain: 450,
    snow: 300,
    hail: 80,
    stars: 500,
    sparkles: 90,
  },
};

export function initialTier(isMobile: boolean): QualityTier {
  return isMobile ? "low" : "high";
}

export function lowerTier(tier: QualityTier): QualityTier {
  return tier === "high" ? "medium" : "low";
}
