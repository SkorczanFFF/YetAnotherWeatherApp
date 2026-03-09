/** Spawn/recycle bounds from camera frustum (PerspectiveCamera) or fixed fallback. */

import * as THREE from "three";
import type { FrustumBounds } from "./types";

const SPAWN_PADDING = 8;
const RECYCLE_PADDING = 14;
/** Must match CameraRig camera.position.z so cloud spawn volume stays aligned with default view. */
const FIXED_CAMERA_Z = 5;

const FALLBACK_BOUNDS: FrustumBounds = {
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

/** Axis-aligned spawn bounds; center fixed (no parallax). Uses camera fov/aspect for box size. */
export function computeAxisAlignedCloudBounds(
  camera: THREE.Camera,
  nearDepth: number,
  farDepth: number,
  spawnYMin: number,
  spawnYMax: number,
): FrustumBounds {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    return { ...FALLBACK_BOUNDS };
  }

  const midDepth = (nearDepth + farDepth) / 2;
  const depthExtent = farDepth - nearDepth;
  const centerZ = FIXED_CAMERA_Z - midDepth;

  const fovRad = (camera.fov * Math.PI) / 180;
  const halfWidth =
    Math.tan(fovRad / 2) * midDepth * camera.aspect + SPAWN_PADDING;

  const spawnXMin = -halfWidth;
  const spawnXMax = halfWidth;
  const spawnZMin = centerZ - depthExtent / 2;
  const spawnZMax = centerZ + depthExtent / 2;

  return {
    spawnXMin,
    spawnXMax,
    spawnYMin,
    spawnYMax,
    spawnZMin,
    spawnZMax,
    recycleY: spawnYMin - RECYCLE_PADDING,
    recycleXMin: spawnXMin - RECYCLE_PADDING,
    recycleXMax: spawnXMax + RECYCLE_PADDING,
    recycleZMin: spawnZMin - RECYCLE_PADDING,
    recycleZMax: spawnZMax + RECYCLE_PADDING,
  };
}

export function getSpawnX(bounds: FrustumBounds): { center: number; radius: number } {
  const center = (bounds.spawnXMin + bounds.spawnXMax) / 2;
  const radius = (bounds.spawnXMax - bounds.spawnXMin) / 2;
  return { center, radius };
}

export function getSpawnZ(bounds: FrustumBounds): { center: number; radius: number } {
  const center = (bounds.spawnZMin + bounds.spawnZMax) / 2;
  const radius = (bounds.spawnZMax - bounds.spawnZMin) / 2;
  return { center, radius };
}
