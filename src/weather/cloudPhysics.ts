/**
 * Cloud physics from Open-Meteo's upper-air, stability and radiation fields.
 * Pure functions, SI units, heights in metres ABOVE GROUND.
 *
 * Every estimate has a fallback, because model fields can be missing (some
 * models, night-time radiation, debug overrides that change the sky).
 *
 *   base      Lifting condensation level ≈ 125 m × (T − Td) (Espy), capped
 *             under the boundary layer top for stratiform decks; fog → ground.
 *   top       Stable air: the boundary layer height (inversion caps the deck),
 *             raised to the highest cloudy low pressure level. Convective air:
 *             grows with CAPE (≈ +4.2 m per J/kg) up to the tropopause.
 *   τ         Optical depth of the low layer from the clearness index
 *             SW / TOA vs. a clear-sky ≈ 0.74, corrected for cloud fraction,
 *             inverted with a two-stream approximation T = 1 / (1 + 0.1125 τ)
 *             (g = 0.85). At night / without data it is estimated from
 *             thickness and precipitation.
 *   layers    Cover-weighted heights of the low/mid/high bands from the
 *             pressure-level cloud cover + geopotential heights.
 *   winds     850 hPa (≈ 1.5 km) for low/mid clouds, 300 hPa (≈ 9 km) for cirrus.
 */

import type { AtmosphereData, Units } from "./types";

export interface WindVector {
  speedMs: number;
  /** Compass bearing the wind blows FROM. */
  fromDeg: number;
}

export interface CloudPhysics {
  /** Low-cloud base above ground, m. */
  baseM: number;
  /** Low-cloud top above ground, m. */
  topM: number;
  /** Centre of the mid (altocumulus) band above ground, m. */
  midAltM: number;
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
  liftedIndex: number | null;
  boundaryLayerM: number | null;
  /** 0 °C level above ground, m. */
  freezingLevelM: number | null;
  windLow: WindVector;
  windHigh: WindVector;
}

export interface CloudPhysicsInput {
  /** Atmosphere in SI (see toAtmosphereSI). */
  atmosphere: AtmosphereSI | null;
  temperatureC: number;
  dewPointC: number;
  clouds: { total: number; low: number };
  surfaceWind: WindVector;
  thunder: boolean;
  showers: boolean;
  precipitating: boolean;
  fog: boolean;
  /** Radiation describes the real sky; ignore it when the debug menu changed the clouds. */
  trustRadiation: boolean;
  /** Debug overrides (undefined = derive). */
  override?: { baseM?: number; topM?: number; cape?: number; opticalDepth?: number };
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (x: number, e0: number, e1: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function speedToMs(speed: number, units: Units): number {
  return units === "imperial" ? speed * 0.44704 : speed / 3.6;
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
    w ? { speedMs: speedToMs(w.speed, units), fromDeg: w.direction } : undefined;
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

function band(levels: AtmosphereSI["levels"], lo: number, hi: number): Band | null {
  let weight = 0;
  let sum = 0;
  let top = 0;
  for (const l of levels) {
    if (l.heightM < lo || l.heightM >= hi || l.cover < 0.15) continue;
    weight += l.cover;
    sum += l.cover * l.heightM;
    top = Math.max(top, l.heightM);
  }
  return weight > 0 ? { meanM: sum / weight, topM: top } : null;
}

/** Clear-sky clearness index (global / top-of-atmosphere) for a mid-latitude atmosphere. */
const CLEAR_SKY_KT = 0.74;
/** Two-stream diffuse transmittance T = 1 / (1 + (1 − g)·0.75·τ), g = 0.85. */
const TWO_STREAM_K = 0.1125;
const TROPOPAUSE_M = 11500;

export function deriveCloudPhysics(input: CloudPhysicsInput): CloudPhysics {
  const atm = input.atmosphere;
  const levels = atm?.levels ?? [];
  const { clouds, override } = input;

  // --- stability ---------------------------------------------------------
  const cape = Math.max(
    0,
    override?.cape ??
      atm?.cape ??
      (input.thunder ? 1500 : input.showers ? 600 : clouds.low > 0.8 ? 30 : 150),
  );
  const li = atm?.liftedIndex ?? null;
  const stabilityDamp = li == null ? 1 : li < 0 ? 1 : li < 3 ? 0.75 : 0.45;
  let convection = smoothstep(cape, 80, 1500) * stabilityDamp;
  if (input.thunder) convection = Math.max(convection, 0.85);
  else if (input.showers) convection = Math.max(convection, 0.55);
  if (override?.cape != null) convection = smoothstep(cape, 80, 1500);

  // --- base --------------------------------------------------------------
  const spread = Math.max(0, input.temperatureC - input.dewPointC);
  let baseM = clamp(125 * spread, 60, 4000);
  const blh = atm?.boundaryLayerM ?? null;
  const lowBand = band(levels, 0, 2500);
  // A stratiform deck sits under the inversion even when the surface air is drier.
  if (blh != null && clouds.low > 0.6 && convection < 0.3) {
    baseM = Math.min(baseM, Math.max(blh - 250, 150));
  }
  if (input.fog) baseM = Math.min(baseM, 120);
  baseM = override?.baseM ?? baseM;

  // --- top ---------------------------------------------------------------
  let stableTop = blh != null && blh > baseM + 150 ? blh : baseM + (clouds.low > 0.8 ? 600 : 900);
  if (lowBand && lowBand.topM + 150 > stableTop) stableTop = lowBand.topM + 150;
  if (input.precipitating) stableTop = Math.max(stableTop, baseM + 1500);
  const convectiveTop = Math.min(TROPOPAUSE_M, baseM + 500 + 4.2 * cape);
  let topM = lerp(stableTop, Math.max(stableTop, convectiveTop), convection);
  topM = Math.max(override?.topM ?? topM, baseM + 150);

  // --- layer heights -----------------------------------------------------
  const midBand = band(levels, 2500, 6500);
  const highBand = band(levels, 6500, 14000);
  const midAltM = midBand?.meanM ?? 4000;
  const highAltM = clamp(highBand?.meanM ?? 8500, 6500, 12500);

  // --- optical depth -----------------------------------------------------
  const thicknessKm = (topM - baseM) / 1000;
  const estimated = clamp(
    thicknessKm * (input.precipitating ? 35 : 16) * (input.thunder ? 1.6 : 1),
    0.5,
    250,
  );
  let opticalDepth = estimated;
  let opticalDepthMeasured = false;
  let directFraction: number | null = null;
  const sw = atm?.shortwave;
  const toa = atm?.topOfAtmosphere;
  if (sw != null && sw > 20 && atm?.direct != null) {
    directFraction = clamp(atm.direct / sw, 0, 1);
  }
  if (input.trustRadiation && sw != null && toa != null && toa > 60 && clouds.total > 0.1) {
    const relative = clamp(sw / toa / CLEAR_SKY_KT, 0, 1.1);
    // Global light = clear part + cloudy part × cloud transmittance.
    const cloudT = clamp((relative - (1 - clouds.total)) / clouds.total, 0.02, 1);
    opticalDepth = clamp((1 / cloudT - 1) / TWO_STREAM_K, 0.3, 250);
    opticalDepthMeasured = true;
  }
  if (override?.opticalDepth != null) {
    opticalDepth = override.opticalDepth;
    opticalDepthMeasured = false;
  }

  // --- winds aloft -------------------------------------------------------
  // Without upper-air data, veer and strengthen the surface wind (Ekman).
  const surface = input.surfaceWind;
  const windLow = atm?.windLow ?? {
    speedMs: Math.max(2, surface.speedMs * 1.7),
    fromDeg: (surface.fromDeg + 15) % 360,
  };
  const windHigh = atm?.windHigh ?? {
    speedMs: surface.speedMs * 3.5 + 8,
    fromDeg: (surface.fromDeg + 30) % 360,
  };

  return {
    baseM,
    topM,
    midAltM,
    highAltM,
    opticalDepth,
    opticalDepthMeasured,
    directFraction,
    convection,
    cape,
    liftedIndex: li,
    boundaryLayerM: blh,
    freezingLevelM: atm?.freezingLevelM ?? null,
    windLow,
    windHigh,
  };
}
