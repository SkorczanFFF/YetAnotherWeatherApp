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

function getFrustumCornersWorld(camera: THREE.PerspectiveCamera): THREE.Vector3[] {
  const { fov, aspect, near, far } = camera;
  const halfFov = (fov * Math.PI) / 360;
  const tanHalfFov = Math.tan(halfFov);
  const wNear = 2 * tanHalfFov * near * aspect;
  const hNear = 2 * tanHalfFov * near;
  const wFar = 2 * tanHalfFov * far * aspect;
  const hFar = 2 * tanHalfFov * far;

  const corners = [
    new THREE.Vector3(-wNear / 2, -hNear / 2, -near),
    new THREE.Vector3(wNear / 2, -hNear / 2, -near),
    new THREE.Vector3(-wNear / 2, hNear / 2, -near),
    new THREE.Vector3(wNear / 2, hNear / 2, -near),
    new THREE.Vector3(-wFar / 2, -hFar / 2, -far),
    new THREE.Vector3(wFar / 2, -hFar / 2, -far),
    new THREE.Vector3(-wFar / 2, hFar / 2, -far),
    new THREE.Vector3(wFar / 2, hFar / 2, -far),
  ];

  camera.updateMatrixWorld(true);
  return corners.map((c) => c.applyMatrix4(camera.matrixWorld));
}

export function computeFrustumBounds(camera: THREE.Camera): FrustumBounds {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    return { ...FALLBACK_BOUNDS };
  }

  const corners = getFrustumCornersWorld(camera);
  return boundsFromCorners(corners);
}

/** Bounds limited to depth band [nearDepth, farDepth] along view axis. */
export function computeFrustumBoundsWithDepth(
  camera: THREE.Camera,
  nearDepth: number,
  farDepth: number,
): FrustumBounds {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    return { ...FALLBACK_BOUNDS };
  }

  const corners = getFrustumCornersWorld(camera);
  const camPos = new THREE.Vector3();
  const direction = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(direction);

  const clampedCorners = corners.map((c) => {
    const depth = c.clone().sub(camPos).dot(direction);
    const clampedDepth = Math.max(
      nearDepth,
      Math.min(farDepth, depth),
    );
    const offset = clampedDepth - depth;
    return c.clone().add(direction.clone().multiplyScalar(offset));
  });

  return boundsFromCorners(clampedCorners);
}

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
  const halfHeight = Math.tan(fovRad / 2) * midDepth + SPAWN_PADDING;

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

function boundsFromCorners(corners: THREE.Vector3[]): FrustumBounds {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
    minZ = Math.min(minZ, c.z);
    maxZ = Math.max(maxZ, c.z);
  }
  return {
    spawnXMin: minX - SPAWN_PADDING,
    spawnXMax: maxX + SPAWN_PADDING,
    spawnYMin: minY - SPAWN_PADDING,
    spawnYMax: maxY + SPAWN_PADDING,
    spawnZMin: minZ - SPAWN_PADDING,
    spawnZMax: maxZ + SPAWN_PADDING,
    recycleXMin: minX - RECYCLE_PADDING,
    recycleXMax: maxX + RECYCLE_PADDING,
    recycleY: minY - RECYCLE_PADDING,
    recycleZMin: minZ - RECYCLE_PADDING,
    recycleZMax: maxZ + RECYCLE_PADDING,
  };
}

export function isPointInSpawnBounds(
  bounds: FrustumBounds,
  x: number,
  y: number,
  z: number
): boolean {
  return (
    x >= bounds.spawnXMin && x <= bounds.spawnXMax &&
    y >= bounds.spawnYMin && y <= bounds.spawnYMax &&
    z >= bounds.spawnZMin && z <= bounds.spawnZMax
  );
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
