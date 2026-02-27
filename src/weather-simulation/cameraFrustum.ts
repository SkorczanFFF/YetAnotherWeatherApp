/**
 * Compute spawn and recycle bounds for weather particles.
 * Bounds are fixed (not derived from camera) for consistent spawn/recycle behavior.
 * Camera at (0, 0, 5), FOV 75°, lookAt (0, 0, 0).
 */

import type * as THREE from "three";
import type { FrustumBounds } from "./types";

/**
 * Returns fixed spawn and recycle bounds. Accepts camera for API compatibility.
 */
export function computeFrustumBounds(_camera: THREE.Camera): FrustumBounds {
  // Spawn at top of volume: y = 8–14, x/z wider for rain/snow coverage
  const spawnYMin = 8;
  const spawnYMax = 14;
  const spawnXMin = -18;
  const spawnXMax = 18;
  const spawnZMin = -14;
  const spawnZMax = 8;

  // Recycle when below or outside extended bounds
  const recycleY = -18;
  const recycleXMin = -28;
  const recycleXMax = 28;
  const recycleZMin = -22;
  const recycleZMax = 14;

  return {
    spawnYMin,
    spawnYMax,
    spawnXMin,
    spawnXMax,
    spawnZMin,
    spawnZMax,
    recycleY,
    recycleXMin,
    recycleXMax,
    recycleZMin,
    recycleZMax,
  };
}

/** Spawn X center and radius for particles. */
export function getSpawnX(bounds: FrustumBounds): { center: number; radius: number } {
  const center = (bounds.spawnXMin + bounds.spawnXMax) / 2;
  const radius = (bounds.spawnXMax - bounds.spawnXMin) / 2;
  return { center, radius };
}

/** Spawn Z center and radius for particles. */
export function getSpawnZ(bounds: FrustumBounds): { center: number; radius: number } {
  const center = (bounds.spawnZMin + bounds.spawnZMax) / 2;
  const radius = (bounds.spawnZMax - bounds.spawnZMin) / 2;
  return { center, radius };
}
