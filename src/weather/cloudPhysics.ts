/**
 * Cloud base/top/optical depth/convection/winds aloft from Open-Meteo's upper-air,
 * stability and radiation fields. Pure, SI, heights in metres ABOVE GROUND; every
 * estimate has a fallback for missing model fields (see CLAUDE.md › Cloud physics).
 */

import type { AtmosphereData, Units } from "./types";
import type { SceneParams } from "./sceneParams";
import { UNITS } from "./units";
import { FOG_VISIBILITY_M } from "./fog";
import { clamp, lerp, smoothstep } from "../utils/math";

interface WindVector {
  speedMs: number;
  /** Compass bearing the wind blows FROM. */
  fromDeg: number;
}

export interface CloudPhysics {
  /** Low-cloud base above ground (LCL, inversion, fog), m. */
  baseM: number;
  /** Low-cloud top above ground, m. */
  topM: number;
  /** The one drawn deck: the low cloud, or the mid band when `midDeck`, m above ground. */
  deckBaseM: number;
  deckTopM: number;
  /** Centre of the mid (altocumulus) band above ground, m. */
  midAltM: number;
  /** The one drawn deck sits in the mid band (altocumulus) instead of at baseM–topM. */
  midDeck: boolean;
  /** The deck stays low and the mid cover is drawn as its own thin layer at midAltM. */
  midLayer: boolean;
  /** Cirrus level above ground, m. */
  highAltM: number;
  /** Optical depth of the low layer. */
  opticalDepth: number;
  /** τ came from measured-in-model radiation (true) or was estimated. */
  opticalDepthMeasured: boolean;
  /** Direct / global shortwave (debug readout: how much sun gets through); null at night. */
  directFraction: number | null;
  /** 0 stable … 1 deep convection. */
  convection: number;
  cape: number;
  /** The model's inputs, echoed for the debug readout. */
  liftedIndex: number | null;
  boundaryLayerM: number | null;
  /** 0 °C level above ground, m (standard lapse rate when the model has none). */
  freezingLevelM: number;
  windLow: WindVector;
  windHigh: WindVector;
}

interface CloudPhysicsInput {
  /** Atmosphere in SI (see toAtmosphereSI). */
  atmosphere: AtmosphereSI | null;
  temperatureC: number;
  dewPointC: number;
  clouds: { low: number; mid: number };
  surfaceWind: WindVector;
  thunder: boolean;
  showers: boolean;
  precipitating: boolean;
  fog: boolean;
  /** The model's sky: radiation and pressure levels describe it — not once the debug menu changed the clouds. */
  measuredSky: boolean;
  /** Debug overrides (undefined = derive). */
  override?: CloudPhysicsOverride;
}

type CloudPhysicsOverride = { baseM?: number; topM?: number; cape?: number; opticalDepth?: number };

/** The physics of a scene's weather — the one place a scene becomes CloudPhysicsInput. */
export function physicsFor(
  scene: Omit<SceneParams, "cloudPhysics">,
  measuredSky: boolean,
  override?: CloudPhysicsOverride,
): CloudPhysics {
  return deriveCloudPhysics({
    atmosphere: scene.atmosphere,
    temperatureC: scene.temperatureC,
    dewPointC: scene.dewPointC,
    clouds: scene.clouds,
    surfaceWind: scene.wind,
    thunder: scene.thunder,
    showers: scene.precip.showers,
    precipitating: scene.precip.rainMmH > 0 || scene.precip.snowCmH > 0,
    fog: scene.fog.visibilityM < FOG_VISIBILITY_M || scene.fog.rime,
    measuredSky,
    override,
  });
}

/** AtmosphereData converted to SI with heights above ground. */
export interface AtmosphereSI {
  boundaryLayerM?: number;
  cape?: number;
  liftedIndex?: number;
  freezingLevelM?: number;
  shortwave?: number;
  direct?: number;
  topOfAtmosphere?: number;
  windLow?: WindVector;
  windHigh?: WindVector;
  /** Height above ground (m) + cover (0..1), ascending. */
  levels: { heightM: number; cover: number }[];
}

export function toAtmosphereSI(
  data: AtmosphereData | undefined,
  units: Units,
): AtmosphereSI | null {
  if (!data) return null;
  const elevation = data.elevationM ?? 0;
  const levels = data.levels
    .map((l) => ({ heightM: l.heightM - elevation, cover: clamp(l.cover / 100, 0, 1) }))
    .filter((l) => l.heightM > 0)
    .sort((a, b) => a.heightM - b.heightM);
  const wind = (w?: { speed: number; direction: number }): WindVector | undefined =>
    w ? { speedMs: UNITS[units].toMs(w.speed), fromDeg: w.direction } : undefined;
  return {
    boundaryLayerM: data.boundaryLayerM,
    cape: data.cape,
    liftedIndex: data.liftedIndex,
    freezingLevelM:
      data.freezingLevelM != null ? Math.max(0, data.freezingLevelM - elevation) : undefined,
    shortwave: data.shortwave,
    direct: data.direct,
    topOfAtmosphere: data.topOfAtmosphere,
    windLow: wind(data.wind850),
    windHigh: wind(data.wind300),
    levels,
  };
}

/** Dew point from temperature and relative humidity (Magnus), °C. */
export function dewPointFromHumidity(temperatureC: number, humidity01: number): number {
  const a = 17.62;
  const b = 243.12;
  const rh = clamp(humidity01, 0.01, 1);
  const g = Math.log(rh) + (a * temperatureC) / (b + temperatureC);
  return (b * g) / (a - g);
}

interface Band {
  /** Cover-weighted mean height, m. */
  meanM: number;
  /** Highest level with notable cover, m. */
  topM: number;
}

/** Pressure-level cover that counts towards a layer's height… */
const BAND_MIN_COVER = 0.15;
/** …and below which a level is clear. */
const CLEAR_LEVEL_COVER = 0.05;

function band(levels: AtmosphereSI["levels"], lo: number, hi: number): Band | null {
  let weight = 0;
  let sum = 0;
  let top = 0;
  for (const l of levels) {
    if (l.heightM < lo || l.heightM >= hi || l.cover < BAND_MIN_COVER) continue;
    weight += l.cover;
    sum += l.cover * l.heightM;
    top = Math.max(top, l.heightM);
  }
  return weight > 0 ? { meanM: sum / weight, topM: top } : null;
}

/** Highest level below `belowM` with at least `minCover` cloud, m above ground (0 when none). */
function highestCloud(levels: AtmosphereSI["levels"], minCover: number, belowM: number): number {
  let top = 0;
  for (const l of levels) if (l.cover >= minCover && l.heightM < belowM) top = Math.max(top, l.heightM);
  return top;
}

/** Lowest level above `minM` with (almost) no cloud, m above ground; null when none. */
function lowestClearAbove(levels: AtmosphereSI["levels"], minM: number): number | null {
  for (const l of levels) if (l.heightM >= minM && l.cover < CLEAR_LEVEL_COVER) return l.heightM;
  return null;
}

/** A deck under an inversion right above its base (lifting fog, thin stratus), m. */
const THIN_DECK_M = 100;
/** Cover of the one low/mid shell the scene draws (high cover is the cirrus; mid weighted 0.85), 0..1. */
export const deckCover = (clouds: { low: number; mid: number }) => Math.max(clouds.low, clouds.mid * 0.85);
/** How much of the sky low/mid cloud closes, unweighted — what dims the sun and greys the sky, 0..1. */
export const skyClosure = (clouds: { low: number; mid: number }) => Math.max(clouds.low, clouds.mid);
/** 0 → 1 as a cover closes into a deck (80 → 100 %). */
export const deckClosing = (cover: number) => smoothstep(cover, 0.8, 1);

/** Mid cover from which a low deck gets a mid layer above it, 0..1. */
const MID_LAYER_MIN = 0.1;
/** A deck drawn in the mid band (altocumulus) spans this far below and above its centre, m. */
const MID_DECK_BELOW_M = 350;
const MID_DECK_ABOVE_M = 450;
/** Pressure levels below this count as the low band, m above ground. */
const LOW_BAND_M = 2500;
/** Standard-atmosphere temperature lapse rate. */
const LAPSE_K_PER_M = 0.0065;
/** Pressure levels from here up count as the cirrus band, m above ground. */
const HIGH_BAND_M = 6500;
/** Convection without showers or a storm: cumulus, never a cumulonimbus. */
const SHALLOW_CONVECTION = 0.6;

/** Clear-sky clearness index (global / top-of-atmosphere) with the sun overhead. */
const CLEAR_SKY_KT = 0.74;
/** …dimming with the air mass (≈ 1/μ0, capped): ~0.6 at a 17° sun. */
const CLEAR_SKY_AIRMASS_K = 0.09;
const MAX_AIRMASS = 6;
/** W/m² — top-of-atmosphere on a horizontal surface ÷ this ≈ μ0, the sine of the sun's altitude. */
const SOLAR_CONSTANT = 1361;
/** Cloud droplet asymmetry parameter (Eddington two-stream below). */
const ASYMMETRY = 0.85;
/** Two-stream diffusion coefficient, (1 − g)·¾ — the clouds' diffuse light and exposure use it too. */
export const TWO_STREAM_K = (1 - ASYMMETRY) * 0.75;
/** Thinnest low/mid cloud we draw — a fair-weather cumulus is τ ≈ 5… */
const MIN_OPTICAL_DEPTH = 3;
/** …and a closed deck: overcast stratus is τ ≈ 10–40. */
const MIN_DECK_OPTICAL_DEPTH = 10;
/** Optical depth per km of a dry cloud: broken cumulus … closed stratiform deck. */
const TAU_PER_KM_CUMULUS = 16;
const TAU_PER_KM_DECK = 30;
/** …and of one that precipitates (nimbostratus, cumulonimbus are τ ≳ 20). */
const MIN_RAIN_OPTICAL_DEPTH = 15;
const TAU_PER_KM_RAIN = 35;
const MAX_OPTICAL_DEPTH = 250;
const TROPOPAUSE_M = 11500;

type Levels = AtmosphereSI["levels"];

interface Convection {
  cape: number;
  liftedIndex: number | null;
  /** 0 stable … 1 deep convection. */
  convection: number;
  /** Showers or a storm: towers may grow past the shallow cap. */
  deep: boolean;
}

function estimateConvection(input: CloudPhysicsInput): Convection {
  const atm = input.atmosphere;
  const { clouds, override } = input;
  const cape = Math.max(
    0,
    override?.cape ??
      atm?.cape ??
      (input.thunder ? 1500 : input.showers ? 600 : clouds.low > 0.8 ? 30 : 150),
  );
  const li = atm?.liftedIndex ?? null;
  const stabilityDamp = li == null ? 1 : li < 0 ? 1 : li < 3 ? 0.75 : 0.45;
  // A pinned CAPE is taken at face value, but showers and storms keep their floor.
  let convection = smoothstep(cape, 80, 1500) * (override?.cape != null ? 1 : stabilityDamp);
  if (input.thunder) convection = Math.max(convection, 0.85);
  else if (input.showers) convection = Math.max(convection, 0.55);
  // CAPE is only potential (a cap or dry air can keep it unused): deep towers
  // need showers or a storm.
  const deep = input.thunder || input.showers;
  if (!deep) convection = Math.min(convection, SHALLOW_CONVECTION);
  return { cape, liftedIndex: li, convection, deep };
}

/** Low-cloud base above ground, m: the LCL, lowered under an inversion or in fog. */
function estimateBase(input: CloudPhysicsInput, convection: number): number {
  const blh = input.atmosphere?.boundaryLayerM ?? null;
  const spread = Math.max(0, input.temperatureC - input.dewPointC);
  let baseM = clamp(125 * spread, 60, 4000);
  // A stratiform deck sits under the inversion even when the surface air is drier.
  if (blh != null && input.clouds.low > 0.6 && convection < 0.3) {
    baseM = Math.min(baseM, Math.max(blh - 250, 150));
  }
  if (input.fog) baseM = Math.min(baseM, 120);
  return input.override?.baseM ?? baseM;
}

/** Low-cloud top above ground, m: the inversion and the column for a stable deck, CAPE for towers. */
function estimateTop(input: CloudPhysicsInput, levels: Levels, baseM: number, c: Convection): number {
  const blh = input.atmosphere?.boundaryLayerM ?? null;
  const lowBand = band(levels, 0, LOW_BAND_M);
  // The inversion caps a deck inside the boundary layer, at least THIN_DECK_M
  // thick (a lifting fog, thin stratus); a boundary layer below the base says nothing.
  let stableTop =
    blh != null && blh >= baseM
      ? Math.max(blh, baseM + THIN_DECK_M)
      : baseM + (input.clouds.low > 0.8 ? 600 : 900);
  if (lowBand && lowBand.topM + 150 > stableTop) stableTop = lowBand.topM + 150;
  // With no cloudy level in the column, the first clear level above the
  // base bounds the deck from above.
  const clearAbove = lowBand ? null : lowestClearAbove(levels, baseM + THIN_DECK_M);
  if (clearAbove != null) stableTop = Math.min(stableTop, clearAbove);
  if (input.precipitating) stableTop = Math.max(stableTop, baseM + 1500);
  let convectiveTop = Math.min(TROPOPAUSE_M, baseM + 500 + 4.2 * c.cape);
  if (!c.deep) {
    // The towers reach no higher than the model puts any cloud in the
    // column (cirrus aside); with none up there, fair-weather to moderate cumulus.
    const columnTop = highestCloud(levels, CLEAR_LEVEL_COVER, HIGH_BAND_M);
    const shallowTop = baseM + 800 + 0.6 * Math.min(c.cape, 2000);
    convectiveTop = Math.min(convectiveTop, Math.max(shallowTop, columnTop + 300));
  }
  const topM = lerp(stableTop, Math.max(stableTop, convectiveTop), c.convection);
  return Math.max(input.override?.topM ?? topM, baseM + 150);
}

type Layers = Pick<CloudPhysics, "midAltM" | "highAltM" | "midDeck" | "midLayer" | "deckBaseM" | "deckTopM">;

/** Mid and cirrus heights, and where the one drawn deck sits. */
function layerHeights(input: CloudPhysicsInput, levels: Levels, baseM: number, topM: number, convection: number): Layers {
  const { clouds } = input;
  const midBand = band(levels, LOW_BAND_M, HIGH_BAND_M);
  const highBand = band(levels, HIGH_BAND_M, 14000);
  const midAltM = midBand?.meanM ?? 4000;
  const highAltM = clamp(highBand?.meanM ?? 8500, HIGH_BAND_M, 12500);
  // One drawn deck: in the mid band when that cover clearly dominates (an
  // altocumulus sky), or outweighs a low cover no pressure level backs up —
  // the model's low layer can be sub-grid while its column is clear (a 49 %
  // "low" under a 78 % mid sky drew a thin deck at the LCL). Convective air
  // keeps the deck low: the towers rise from the boundary layer.
  const lowLevels = levels.filter((l) => l.heightM < LOW_BAND_M);
  const lowLevelsClear =
    input.measuredSky && lowLevels.length > 0 && lowLevels.every((l) => l.cover < CLEAR_LEVEL_COVER);
  const midDeck =
    (clouds.low < 0.3 || lowLevelsClear) &&
    clouds.mid > Math.max(0.15, clouds.low * 1.3) &&
    convection < 0.5;
  return {
    midAltM,
    highAltM,
    midDeck,
    midLayer: !midDeck && clouds.mid >= MID_LAYER_MIN,
    deckBaseM: midDeck ? midAltM - MID_DECK_BELOW_M : baseM,
    deckTopM: midDeck ? midAltM + MID_DECK_ABOVE_M : topM,
  };
}

type OpticalDepth = Pick<CloudPhysics, "opticalDepth" | "opticalDepthMeasured" | "directFraction">;

/** τ of the drawn deck: estimated from its thickness, blended towards the radiation's by day. */
function estimateOpticalDepth(input: CloudPhysicsInput, deckBaseM: number, deckTopM: number): OpticalDepth {
  const atm = input.atmosphere;
  const thicknessKm = (deckTopM - deckBaseM) / 1000;
  // Only low/mid cloud dims the sun much — cirrus is τ ≲ 1 — so the
  // radiation is attributed to that cover alone.
  const deck = skyClosure(input.clouds);
  const closed = deckClosing(deck);
  const tauPerKm = input.precipitating ? TAU_PER_KM_RAIN : lerp(TAU_PER_KM_CUMULUS, TAU_PER_KM_DECK, closed);
  const estimated = clamp(thicknessKm * tauPerKm * (input.thunder ? 1.6 : 1), 0.5, MAX_OPTICAL_DEPTH);
  let opticalDepth = estimated;
  let opticalDepthMeasured = false;
  let directFraction: number | null = null;
  const sw = atm?.shortwave;
  const toa = atm?.topOfAtmosphere;
  if (sw != null && sw > 20 && atm?.direct != null) {
    directFraction = clamp(atm.direct / sw, 0, 1);
  }
  if (input.measuredSky && sw != null && toa != null && toa > 60 && deck > 0.1) {
    // A low sun crosses more air and more cloud: assuming it overhead read
    // autumn mornings as τ 100–250 (black decks) under plain stratus.
    const mu0 = clamp(toa / SOLAR_CONSTANT, 0.05, 1);
    const clearKt = CLEAR_SKY_KT * Math.exp(-CLEAR_SKY_AIRMASS_K * (Math.min(1 / mu0, MAX_AIRMASS) - 1));
    const relative = clamp(sw / toa / clearKt, 0, 1.1);
    // Global light = clear part + cloudy part × cloud transmittance.
    const cloudT = clamp((relative - (1 - deck)) / deck, 0.02, 1);
    // Eddington two-stream, conservative scattering: T = (2/3 + μ0) / (4/3 + (1 − g)·τ).
    const measured = Math.max(MIN_OPTICAL_DEPTH, ((2 / 3 + mu0) / cloudT - 4 / 3) / (1 - ASYMMETRY));
    // One point reading can't tell a gap over the sun from thin cloud (or a
    // shower core from a deck), so it is trusted only as the deck closes, and
    // not with the sun near the horizon (mostly diffuse light, hourly means
    // straddling sunrise); otherwise the thickness estimate leads (log space).
    const trust = smoothstep(deck, 0.5, 0.9) * smoothstep(mu0, 0.1, 0.35);
    opticalDepth = Math.exp(lerp(Math.log(estimated), Math.log(measured), trust));
    opticalDepthMeasured = trust >= 0.5;
  }
  // A cloud that rains is never thin, whatever a sunny gap told the sensor.
  const minDepth = input.precipitating
    ? MIN_RAIN_OPTICAL_DEPTH
    : lerp(MIN_OPTICAL_DEPTH, MIN_DECK_OPTICAL_DEPTH, closed);
  opticalDepth = clamp(opticalDepth, minDepth, MAX_OPTICAL_DEPTH);
  if (input.override?.opticalDepth != null) {
    opticalDepth = input.override.opticalDepth;
    opticalDepthMeasured = false;
  }
  return { opticalDepth, opticalDepthMeasured, directFraction };
}

/** 850 and 300 hPa winds; without upper-air data, the surface wind veered and strengthened (Ekman). */
function windsAloft(input: CloudPhysicsInput): Pick<CloudPhysics, "windLow" | "windHigh"> {
  const atm = input.atmosphere;
  const surface = input.surfaceWind;
  return {
    windLow: atm?.windLow ?? {
      speedMs: Math.max(2, surface.speedMs * 1.7),
      fromDeg: (surface.fromDeg + 15) % 360,
    },
    windHigh: atm?.windHigh ?? {
      speedMs: surface.speedMs * 3.5 + 8,
      fromDeg: (surface.fromDeg + 30) % 360,
    },
  };
}

function deriveCloudPhysics(input: CloudPhysicsInput): CloudPhysics {
  const atm = input.atmosphere;
  const levels = atm?.levels ?? [];
  const c = estimateConvection(input);
  const baseM = estimateBase(input, c.convection);
  const topM = estimateTop(input, levels, baseM, c);
  const layers = layerHeights(input, levels, baseM, topM, c.convection);
  return {
    baseM,
    topM,
    ...layers,
    ...estimateOpticalDepth(input, layers.deckBaseM, layers.deckTopM),
    convection: c.convection,
    cape: c.cape,
    liftedIndex: c.liftedIndex,
    boundaryLayerM: atm?.boundaryLayerM ?? null,
    freezingLevelM: atm?.freezingLevelM ?? Math.max(0, input.temperatureC / LAPSE_K_PER_M),
    ...windsAloft(input),
  };
}
