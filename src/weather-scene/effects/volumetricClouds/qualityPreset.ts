import type { CloudsQualityPreset } from "@takram/three-clouds";

export type QualityTier = "low" | "medium" | "high" | "ultra";

export interface RuntimePreset {
  tier: QualityTier;
  cloudsPreset: CloudsQualityPreset;
  resolutionScale: number;
  flareReadEvery: number;
  godRaysSamples: number;
  godRaysEnabled: boolean;
  moonFlareEnabled: boolean;
}

const PRESETS: Record<QualityTier, RuntimePreset> = {
  low: {
    tier: "low",
    cloudsPreset: "low",
    resolutionScale: 0.5,
    flareReadEvery: 10,
    godRaysSamples: 0,
    godRaysEnabled: false,
    moonFlareEnabled: false,
  },
  medium: {
    tier: "medium",
    cloudsPreset: "medium",
    resolutionScale: 0.75,
    flareReadEvery: 6,
    godRaysSamples: 40,
    godRaysEnabled: true,
    moonFlareEnabled: true,
  },
  high: {
    tier: "high",
    cloudsPreset: "high",
    resolutionScale: 1,
    flareReadEvery: 3,
    godRaysSamples: 80,
    godRaysEnabled: true,
    moonFlareEnabled: true,
  },
  ultra: {
    tier: "ultra",
    cloudsPreset: "ultra",
    resolutionScale: 1,
    flareReadEvery: 2,
    godRaysSamples: 128,
    godRaysEnabled: true,
    moonFlareEnabled: true,
  },
};

export function detectQualityTier(): QualityTier {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const mobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobileUA && (cores <= 4 || dpr >= 2)) return "low";
  if (mobileUA) return "medium";
  if (cores <= 4) return "medium";
  return "high";
}

export function getRuntimePreset(tier: QualityTier = detectQualityTier()): RuntimePreset {
  return PRESETS[tier];
}
