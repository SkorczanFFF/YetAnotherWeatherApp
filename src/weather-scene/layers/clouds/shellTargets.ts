import { MathUtils } from "three";
import { deckCover } from "../../../weather/cloudPhysics";
import type { SceneParams } from "../../../weather/sceneParams";

// Weather → shell parameters, from the cloud physics (weather/cloudPhysics.ts):
// base/top from dew point, boundary layer and CAPE; density from the optical
// depth (radiation-derived by day); cirrus height from the pressure levels.
export interface ShellTargets {
  coverage: number;
  /** 0 stratus · 0.3 altocumulus · 0.5 cumulus · 1 cumulonimbus. */
  type: number;
  thickness: number;
  base: number;
  /** Extinction per metre at noise density 1. */
  density: number;
  /** Optical depth of the whole deck (cloudPhysics) — diffuse light and exposure. */
  opticalDepth: number;
  /** Noise size multiplier, ≤ 1: cells shrink with a low deck's height. */
  featureScale: number;
  /** Cover of the thin mid layer above a low deck (0 when the shell is the mid deck). */
  midLayer: number;
  midAlt: number;
  high: number;
  cirrusAlt: number;
  freezeAlt: number;
}

/** Mean fill of the shaped noise inside the shell — converts τ into extinction. */
const SHELL_FILL = 0.35;
/**
 * Deck mid-height the noise scales were tuned at (cumulus, m). A lower deck is
 * closer, so its cells shrink with it to keep their angular size.
 */
const FEATURE_REF_M = 1200;
const MIN_FEATURE_SCALE = 0.2;
/** Shell base floor, m: a debug base of 0 would put the camera inside the shell. */
const MIN_BASE_M = 30;
/** Eased fields; one missing here would silently freeze, so the Record makes it a type error. */
const SHELL_KEY_SET = {
  coverage: 1, type: 1, thickness: 1, base: 1, density: 1, opticalDepth: 1, featureScale: 1, midLayer: 1, midAlt: 1, high: 1, cirrusAlt: 1, freezeAlt: 1,
} satisfies Record<keyof ShellTargets, 1>;
export const SHELL_KEYS = Object.keys(SHELL_KEY_SET) as (keyof ShellTargets)[];

/** How dark storms and precipitation make the clouds, 0..1: a storm 1, heavy rain or snow up to 0.6. */
export const stormDim = (params: SceneParams): number =>
  params.thunder ? 1 : Math.min(0.6, params.precip.rainMmH / 12 + params.precip.snowCmH / 6);

export function shellTargets(params: SceneParams): ShellTargets {
  const { low, mid, high, total } = params.clouds;
  const p = params.cloudPhysics;
  // One shell, at the mid level when cloudPhysics puts the deck there.
  const base = Math.max(MIN_BASE_M, p.midDeck ? p.midAltM - 350 : p.baseM);
  const top = p.midDeck ? p.midAltM + 450 : p.topM;
  const thickness = MathUtils.clamp(top - base, 80, 12000);
  const conv = p.convection;
  const type = params.thunder
    ? 1
    : p.midDeck
      ? 0.3
      : low >= 0.85 && conv < 0.25
        ? 0.06 + 0.2 * conv
        : MathUtils.clamp(0.35 + 0.65 * conv, 0, 1);
  return {
    // The shell is the low/mid cloud — low alone when the mid cover has its
    // own layer; high cover is the cirrus layer, not cumulus. Total cover
    // only stands in when no layer explains it.
    coverage: MathUtils.clamp(
      Math.max(p.midLayer ? low : deckCover(params.clouds), low + mid + high < 0.05 ? total : 0),
      0,
      1,
    ),
    type,
    thickness,
    base,
    density: MathUtils.clamp(p.opticalDepth / (thickness * SHELL_FILL), 0.004, 0.15),
    opticalDepth: p.opticalDepth,
    featureScale: MathUtils.clamp((base + thickness * 0.5) / FEATURE_REF_M, MIN_FEATURE_SCALE, 1),
    midLayer: p.midLayer ? mid : 0,
    midAlt: p.midAltM,
    high,
    cirrusAlt: p.highAltM,
    freezeAlt: p.freezingLevelM,
  };
}
