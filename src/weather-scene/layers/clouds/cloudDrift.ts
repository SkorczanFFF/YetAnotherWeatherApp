import { MathUtils, type Vector2, type Vector4 } from "three";
import { COVER_OCTAVES, COVER_TILE_M, DETAIL_TILE_M, SHAPE_TILE_M } from "../../shaders/clouds/density.glsl";
import { CIRRUS_TILES_M, MID_CELL_SCALE, MID_CELLS_TILE_M } from "../../shaders/clouds/layers.glsl";
import { DECK_HIGH_TILES, DECK_LOW_OCTAVE, DECK_LOW_TILE } from "../../shaders/cloudDeck.glsl";

// The cloud drifts grow without bound. In JS doubles that's exact for ages,
// but a float32 uniform isn't: within a day of drift the 520 m detail noise
// moved in visible steps. The 3D noise repeats every tile, so a drift shifted
// by whole tiles of every lookup that reads it draws exactly the same — each
// drift goes to the GPU wrapped by that common period or, for the cirrus (read
// in the wind's rotated frame), as fractions of its tiles.

/** Cover (10 km × 1, 0.43, 2.3) and shape (3.2 km) lookups all repeat after 2000 km of noise space. */
const LOW_PERIOD = 2_000_000;
/** The mid layer's cover (at ×2.5) and its 1.6 km cells, for its drift (half the 300 hPa one), m. */
const MID_PERIOD = 400_000;
/** Potato deck: its low cover and the ×2.7 octave repeat after 10 tiles (scene units). */
const DECK_LOW_PERIOD = DECK_LOW_TILE * 10;

function assertPeriod(period: number, scales: number[]): void {
  for (const scale of scales) {
    const tiles = period * scale;
    if (Math.abs(tiles - Math.round(tiles)) > 1e-6) {
      throw new Error(`cloud drift period ${period} m is not a whole number of tiles at 1/${1 / scale} m`);
    }
  }
}

if (import.meta.env.DEV) {
  assertPeriod(LOW_PERIOD, [...COVER_OCTAVES.map((k) => k / COVER_TILE_M), 1 / SHAPE_TILE_M]);
  assertPeriod(MID_PERIOD, [...COVER_OCTAVES.map((k) => (k * MID_CELL_SCALE) / COVER_TILE_M), 1 / MID_CELLS_TILE_M]);
  assertPeriod(DECK_LOW_PERIOD, [1 / DECK_LOW_TILE, DECK_LOW_OCTAVE / DECK_LOW_TILE]);
}

const wrap = MathUtils.euclideanModulo;

/** The low/mid shell's drift (noise space, xz) → uWind (cover, shape) and uWindDetail. */
export function lowDrift(windNoise: Vector2, outWind: Vector2, outDetail: Vector2): void {
  outWind.set(wrap(windNoise.x, LOW_PERIOD), wrap(windNoise.y, LOW_PERIOD));
  outDetail.set(wrap(windNoise.x, DETAIL_TILE_M), wrap(windNoise.y, DETAIL_TILE_M));
}

/**
 * The 300 hPa drift (m, xz) → uMidDrift (half of it, wrapped) and uCirrusDrift
 * (along / across `dir`, the unit wind direction, in tiles of each cirrus lookup).
 */
export function highDrift(x: number, z: number, dir: Vector2, outMid: Vector2, outCirrus: Vector4): void {
  outMid.set(wrap(x * 0.5, MID_PERIOD), wrap(z * 0.5, MID_PERIOD));
  const along = x * dir.x + z * dir.y;
  const across = -x * dir.y + z * dir.x;
  const [a, b] = CIRRUS_TILES_M;
  outCirrus.set(wrap(along / a[0], 1), wrap(across / a[1], 1), wrap(along / b[0], 1), wrap(across / b[1], 1));
}

/**
 * The potato deck's drifts (scene units, xz) → uDrift (wrapped) and uDriftHigh
 * (along / across `dir`, the unit wind direction, in tiles).
 */
export function deckDrift(
  lowX: number,
  lowZ: number,
  highX: number,
  highZ: number,
  dir: Vector2,
  outLow: Vector2,
  outHigh: Vector2,
): void {
  outLow.set(wrap(lowX, DECK_LOW_PERIOD), wrap(lowZ, DECK_LOW_PERIOD));
  const along = highX * dir.x + highZ * dir.y;
  const across = -highX * dir.y + highZ * dir.x;
  outHigh.set(wrap(along / DECK_HIGH_TILES[0], 1), wrap(across / DECK_HIGH_TILES[1], 1));
}
