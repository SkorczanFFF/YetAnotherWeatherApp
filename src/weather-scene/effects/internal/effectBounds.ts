import type { FrustumBounds } from "../../types";

export const PRECIPITATION_BOUNDS: FrustumBounds = {
  spawnYMin: 8,
  spawnYMax: 14,
  spawnXMin: -18,
  spawnXMax: 18,
  spawnZMin: -14,
  spawnZMax: 8,
  recycleY: -18,
  recycleXMin: -28,
  recycleXMax: 28,
  recycleZMin: -22,
  recycleZMax: 14,
};

export const MIST_BOUNDS = {
  spawn: { x: 0, y: 2, z: -2 },
  recycle: { xMin: -18, xMax: 18, zMin: -14, zMax: 10 },
} as const;
