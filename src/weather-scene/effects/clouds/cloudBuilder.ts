/** Cloud box descriptors (no Three.js). Small 1–3, medium 4–8, large 9–14, extreme 20–30, blanket 1–3 boxes; axis-aligned stack. */

export type CloudSize = "small" | "medium" | "large" | "extreme" | "blanket";

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
  extreme: [20, 30],
  blanket: [1, 3],
};

const DIRECTIONS: ReadonlyArray<[number, number, number]> = [
  [0, 1, 0],
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Extreme clouds spread horizontally to fill gaps; less vertical stacking. */
const EXTREME_DIRECTIONS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 0],
  [0, -1, 0],
];

/** Blanket clouds spread purely horizontal for maximum flat coverage. */
const BLANKET_DIRECTIONS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const OVERLAP = 0.25;
const EXTREME_OVERLAP = 0.4;
const BLANKET_OVERLAP = 0.6;
const CLOUD_SCALE = 2.5;

function createRng(seed: number) {
  let s = seed;
  return function next(): number {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Random half-extents (half of scale) for one box; flatter in Y. Scaled by CLOUD_SCALE * extraScale. */
function randomHalfExtents(
  size: CloudSize,
  rng: () => number,
  extraScale: number = 1,
): [number, number, number] {
  const isBlanket = size === "blanket";
  const isExtreme = size === "extreme";

  if (isBlanket) {
    // Blanket: very large flat sheets (half-extent X/Z = 8-12, Y = 0.3-0.5)
    const hx = 8 + rng() * 4;
    const hz = 8 + rng() * 4;
    const hy = 0.3 + rng() * 0.2;
    return [hx, hy, hz];
  }

  const base =
    size === "small"
      ? 0.15 + rng() * 0.25
      : size === "medium"
        ? 0.2 + rng() * 0.3
        : isExtreme
          ? 0.2 + rng() * 0.3
          : 0.2 + rng() * 0.35;
  const s = CLOUD_SCALE * extraScale;
  const hx = s * base * (0.8 + rng() * 0.4);
  const hz = s * base * (0.8 + rng() * 0.4);
  const yFlatten = isExtreme ? 0.25 : 0.3;
  const hy = s * base * yFlatten * (0.6 + rng() * 0.8);
  return [hx, hy, hz];
}

export function buildCloud(
  size: CloudSize,
  seed?: number,
  scale: number = 1,
  boxCountOverride?: [number, number],
): CloudDescriptor {
  const rng = createRng(
    seed ?? Math.floor(Math.random() * 0xffffffff)
  );
  const [minBoxes, maxBoxes] = boxCountOverride ?? BOX_COUNTS[size];
  const numBoxes =
    minBoxes + Math.floor(rng() * (maxBoxes - minBoxes + 1));

  interface Placed {
    center: [number, number, number];
    halfExtents: [number, number, number];
  }
  const placed: Placed[] = [];

  const isBlanket = size === "blanket";
  const isExtreme = size === "extreme";

  for (let i = 0; i < numBoxes; i++) {
    const half = randomHalfExtents(size, rng, scale);
    if (i === 0) {
      placed.push({ center: [0, 0, 0], halfExtents: half });
      continue;
    }
    const parentIdx = Math.floor(rng() * placed.length);
    const parent = placed[parentIdx];
    const dirs = isBlanket
      ? BLANKET_DIRECTIONS
      : isExtreme
        ? EXTREME_DIRECTIONS
        : DIRECTIONS;
    const dir = dirs[Math.floor(rng() * dirs.length)];
    const [phx, phy, phz] = parent.halfExtents;
    const [nhx, nhy, nhz] = half;
    const overlap = isBlanket ? BLANKET_OVERLAP : isExtreme ? EXTREME_OVERLAP : OVERLAP;
    const dist =
      (Math.abs(dir[0]) * (phx + nhx) +
        Math.abs(dir[1]) * (phy + nhy) +
        Math.abs(dir[2]) * (phz + nhz)) *
      (1 - overlap);
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
