import * as THREE from "three";
import type { FrustumBounds } from "../types";
import { WIND_GUST_VARIANCE, windToXZ } from "../physics/weatherPhysics";

export interface SpawnParams {
  xCenter: number;
  xRadius: number;
  zCenter: number;
  zRadius: number;
  y: number;
}

export function computeSpawnParams(bounds: FrustumBounds): SpawnParams {
  const xCenter = (bounds.spawnXMin + bounds.spawnXMax) / 2;
  const xRadius = (bounds.spawnXMax - bounds.spawnXMin) / 2;
  const zCenter = (bounds.spawnZMin + bounds.spawnZMax) / 2;
  const zRadius = (bounds.spawnZMax - bounds.spawnZMin) / 2;
  return {
    xCenter,
    xRadius,
    zCenter,
    zRadius,
    y: (bounds.spawnYMin + bounds.spawnYMax) / 2,
  };
}

export function initParticlePositions(
  count: number,
  bounds: FrustumBounds,
): Float32Array {
  const { xCenter, xRadius, zCenter, zRadius } = computeSpawnParams(bounds);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = xCenter + (Math.random() - 0.5) * 2 * xRadius;
    positions[i * 3 + 1] =
      bounds.recycleY +
      Math.random() * (bounds.spawnYMax - bounds.recycleY);
    positions[i * 3 + 2] = zCenter + (Math.random() - 0.5) * 2 * zRadius;
  }
  return positions;
}

export function recycleParticle(
  pos: Float32Array,
  i3: number,
  bounds: FrustumBounds,
  spawn: SpawnParams,
): boolean {
  if (
    pos[i3 + 1] < bounds.recycleY ||
    pos[i3] < bounds.recycleXMin ||
    pos[i3] > bounds.recycleXMax ||
    pos[i3 + 2] < bounds.recycleZMin ||
    pos[i3 + 2] > bounds.recycleZMax
  ) {
    pos[i3] = spawn.xCenter + (Math.random() - 0.5) * 2 * spawn.xRadius;
    pos[i3 + 1] = spawn.y + Math.random() * 2;
    pos[i3 + 2] = spawn.zCenter + (Math.random() - 0.5) * 2 * spawn.zRadius;
    return true;
  }
  return false;
}

export interface WindResult {
  windX: number;
  windZ: number;
  gust: number;
}

export function computeWind(
  windDirectionDeg: number,
  windSpeed: number,
  windFactor: number,
): WindResult {
  const gust = 1 + (Math.random() - 0.5) * 2 * WIND_GUST_VARIANCE;
  const { x: windX, z: windZ } = windToXZ(windDirectionDeg, windSpeed, windFactor * gust);
  return { windX, windZ, gust };
}

export function cleanupParticles(
  group: THREE.Group,
  points: THREE.Points,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pointsRef: React.MutableRefObject<THREE.Points | null>,
  geometryRef: React.MutableRefObject<THREE.BufferGeometry | null>,
): void {
  group.remove(points);
  geometry.dispose();
  material.dispose();
  pointsRef.current = null;
  geometryRef.current = null;
}
