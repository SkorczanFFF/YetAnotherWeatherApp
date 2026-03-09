import type { CloudSize } from "./cloudBuilder";

export type CloudTierName = "light" | "medium" | "overcast" | "extreme" | "fullcover";

export interface CloudTierConfig {
  name: CloudTierName;
  count: number;
  yRanges: [number, number][];
  sizeWeights: Record<CloudSize, number>;
  cloudScale: number;
  largeBoxCountOverride?: [number, number];
  opacityRange: [number, number];
}

const LIGHT_TIER: CloudTierConfig = {
  name: "light",
  count: 50,
  yRanges: [[7, 11]],
  sizeWeights: { small: 0.5, medium: 0.35, large: 0.15, extreme: 0, blanket: 0 },
  cloudScale: 1,
  opacityRange: [0.15, 0.5],
};

const MEDIUM_TIER: CloudTierConfig = {
  name: "medium",
  count: 80,
  yRanges: [[6, 9], [9.5, 12]],
  sizeWeights: { small: 0.2, medium: 0.5, large: 0.3, extreme: 0, blanket: 0 },
  cloudScale: 1.3,
  opacityRange: [0.35, 0.7],
};

const OVERCAST_TIER: CloudTierConfig = {
  name: "overcast",
  count: 120,
  yRanges: [[5, 7.5], [7.5, 10], [10, 12.5], [12, 14]],
  sizeWeights: { small: 0, medium: 0.3, large: 0.7, extreme: 0, blanket: 0 },
  cloudScale: 1.8,
  largeBoxCountOverride: [14, 20],
  opacityRange: [0.6, 0.95],
};

const EXTREME_TIER: CloudTierConfig = {
  name: "extreme",
  count: 160,
  yRanges: [[6, 9], [8.5, 11.5], [11, 14], [13, 16]],
  sizeWeights: { small: 0, medium: 0, large: 0.15, extreme: 0.85, blanket: 0 },
  cloudScale: 2.5,
  largeBoxCountOverride: [16, 24],
  opacityRange: [0.85, 1.0],
};

const FULLCOVER_TIER: CloudTierConfig = {
  name: "fullcover",
  count: 200,
  yRanges: [[6, 8], [8, 10.5], [10.5, 13], [12.5, 15]],
  sizeWeights: { small: 0, medium: 0, large: 0, extreme: 0.5, blanket: 0.5 },
  cloudScale: 2.8,
  largeBoxCountOverride: [16, 24],
  opacityRange: [0.9, 1.0],
};

export function getTierForCover(cloudCover: number): CloudTierConfig {
  if (cloudCover <= 0.35) return LIGHT_TIER;
  if (cloudCover <= 0.7) return MEDIUM_TIER;
  if (cloudCover <= 0.85) return OVERCAST_TIER;
  if (cloudCover <= 0.95) return EXTREME_TIER;
  return FULLCOVER_TIER;
}

export function pickWeightedSize(weights: Record<CloudSize, number>): CloudSize {
  const r = Math.random();
  const { small, medium, large, extreme } = weights;
  if (r < small) return "small";
  if (r < small + medium) return "medium";
  if (r < small + medium + large) return "large";
  if (r < small + medium + large + extreme) return "extreme";
  return "blanket";
}

export function getGlobalYRange(yRanges: [number, number][]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const [lo, hi] of yRanges) {
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  return [min, max];
}
