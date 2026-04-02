import type { FrustumBounds } from "../../types";

const UPWIND_BIAS = 0.75;
const BASE_UPWIND_MARGIN = 5;
const UPWIND_MARGIN_PER_WIND = 0.1;

function randomYFromFloors(yRanges: [number, number][]): number {
  const floor = yRanges[Math.floor(Math.random() * yRanges.length)];
  return floor[0] + Math.random() * (floor[1] - floor[0]);
}

export function randomSpawnPositionFromBounds(
  bounds: FrustumBounds,
  windDirectionDeg: number,
  windSpeed: number,
  yRanges: [number, number][],
): { x: number; y: number; z: number } {
  const windRad = (windDirectionDeg * Math.PI) / 180;
  const windX = Math.sin(windRad);
  const windZ = -Math.cos(windRad);
  const upwindX = -windX;
  const upwindZ = -windZ;

  const upwindMargin = BASE_UPWIND_MARGIN + windSpeed * UPWIND_MARGIN_PER_WIND;
  const spawnXMin = bounds.spawnXMin + Math.min(0, upwindX) * upwindMargin;
  const spawnXMax = bounds.spawnXMax + Math.max(0, upwindX) * upwindMargin;
  const spawnZMin = bounds.spawnZMin + Math.min(0, upwindZ) * upwindMargin;
  const spawnZMax = bounds.spawnZMax + Math.max(0, upwindZ) * upwindMargin;

  const xCenter = (spawnXMin + spawnXMax) / 2;
  const zCenter = (spawnZMin + spawnZMax) / 2;
  const xRadius = (spawnXMax - spawnXMin) / 2;
  const zRadius = (spawnZMax - spawnZMin) / 2;

  let x =
    xCenter +
    upwindX * xRadius * UPWIND_BIAS +
    (Math.random() - 0.5) * 2 * xRadius * 0.9;
  let z =
    zCenter +
    upwindZ * zRadius * UPWIND_BIAS +
    (Math.random() - 0.5) * 2 * zRadius * 0.9;
  x = Math.max(spawnXMin, Math.min(spawnXMax, x));
  z = Math.max(spawnZMin, Math.min(spawnZMax, z));

  const y = randomYFromFloors(yRanges);

  return { x, y, z };
}
