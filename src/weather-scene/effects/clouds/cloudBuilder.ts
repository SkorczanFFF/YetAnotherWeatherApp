/**
 * Pure cloud builder: returns descriptors for cloud boxes (no Three.js).
 * Small 1–3, medium 4–8, large 9–14 boxes.
 * Boxes are stacked/stuck together (no rotation); each piece has random size.
 */

export type CloudSize = "small" | "medium" | "large";

export interface BoxDescriptor {
  position: [number, number, number];
  scale: [number, number, number];
}

export interface CloudDescriptor {
  size: CloudSize;
  boxes: BoxDescriptor[];
}

const BOX_COUNTS: Record<CloudSize, [number, number]> = {
  small: [1, 3],
  medium: [4, 8],
  large: [9, 14],
};

/** Axis-aligned directions for stick/stack: +Y, -Y, +X, -X, +Z, -Z. +Y biased for stacking. */
const DIRECTIONS: ReadonlyArray<[number, number, number]> = [
  [0, 1, 0],
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const OVERLAP = 0.25;

/** Scale multiplier so clouds appear larger in the scene. */
const CLOUD_SCALE = 2.5;

/** Seeded LCG for deterministic builds when seed is provided. */
function createRng(seed: number) {
  let s = seed;
  return function next(): number {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function getBoxCountForSize(size: CloudSize): [number, number] {
  return BOX_COUNTS[size];
}

/** Random half-extents (half of scale) for one box; flatter in Y. Scaled by CLOUD_SCALE. */
function randomHalfExtents(
  size: CloudSize,
  rng: () => number
): [number, number, number] {
  const base =
    size === "small"
      ? 0.15 + rng() * 0.25
      : size === "medium"
        ? 0.2 + rng() * 0.3
        : 0.2 + rng() * 0.35;
  const hx = CLOUD_SCALE * base * (0.8 + rng() * 0.4);
  const hz = CLOUD_SCALE * base * (0.8 + rng() * 0.4);
  const hy = CLOUD_SCALE * base * 0.3 * (0.6 + rng() * 0.8);
  return [hx, hy, hz];
}

/**
 * Build one cloud by sticking/stacking boxes. First box at origin; each next
 * attaches to a random existing box along an axis-aligned direction (no rotation).
 * When seed is provided, output is deterministic.
 */
export function buildCloud(size: CloudSize, seed?: number): CloudDescriptor {
  const rng = createRng(
    seed ?? Math.floor(Math.random() * 0xffffffff)
  );
  const [minBoxes, maxBoxes] = BOX_COUNTS[size];
  const numBoxes =
    minBoxes + Math.floor(rng() * (maxBoxes - minBoxes + 1));

  interface Placed {
    center: [number, number, number];
    halfExtents: [number, number, number];
  }
  const placed: Placed[] = [];

  for (let i = 0; i < numBoxes; i++) {
    const half = randomHalfExtents(size, rng);
    if (i === 0) {
      placed.push({ center: [0, 0, 0], halfExtents: half });
      continue;
    }
    const parentIdx = Math.floor(rng() * placed.length);
    const parent = placed[parentIdx];
    const dir = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)];
    const [phx, phy, phz] = parent.halfExtents;
    const [nhx, nhy, nhz] = half;
    const dist =
      (Math.abs(dir[0]) * (phx + nhx) +
        Math.abs(dir[1]) * (phy + nhy) +
        Math.abs(dir[2]) * (phz + nhz)) *
      (1 - OVERLAP);
    const center: [number, number, number] = [
      parent.center[0] + dir[0] * dist,
      parent.center[1] + dir[1] * dist,
      parent.center[2] + dir[2] * dist,
    ];
    placed.push({ center, halfExtents: half });
  }

  const boxes: BoxDescriptor[] = placed.map(({ center, halfExtents }) => ({
    position: center,
    scale: [
      halfExtents[0] * 2,
      halfExtents[1] * 2,
      halfExtents[2] * 2,
    ],
  }));

  return { size, boxes };
}
