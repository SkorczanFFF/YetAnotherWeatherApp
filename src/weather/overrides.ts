/** Debug-menu overrides: the keys and applying them to measured SceneParams. */

import { DateTime } from "luxon";
import { clamp, clamp01 } from "../utils/math";
import { dewPointFromHumidity, physicsFor } from "./cloudPhysics";
import { RIME_VISIBILITY_M } from "./fog";
import { finalizePrecip, type PrecipState } from "./precip";
import type { CloudLayers, SceneParams } from "./sceneParams";
import type { QualityTier } from "../weather-scene/core/quality";

export type Auto<T> = T | "auto";

/** Debug overrides. "auto" (or undefined) = use the weather-driven value. */
export interface SceneOverrides {
  /** Local hour at the viewed location, 0..24 (fractional). */
  hour?: Auto<number>;
  /** Local date at the viewed location, YYYY-MM-DD. */
  date?: Auto<string>;
  cloudLow?: Auto<number>;
  cloudMid?: Auto<number>;
  cloudHigh?: Auto<number>;
  /** m/s */
  windSpeed?: Auto<number>;
  /** m/s */
  windGust?: Auto<number>;
  windFrom?: Auto<number>;
  /** mm/h */
  rain?: Auto<number>;
  /** cm/h */
  snow?: Auto<number>;
  drizzle?: Auto<boolean>;
  freezing?: Auto<boolean>;
  showers?: Auto<boolean>;
  hail?: Auto<boolean>;
  grains?: Auto<boolean>;
  thunder?: Auto<boolean>;
  /** metres */
  visibility?: Auto<number>;
  rime?: Auto<boolean>;
  /** °C */
  temperature?: Auto<number>;
  /** 0..1 */
  humidity?: Auto<number>;
  /** Low-cloud base / top above ground, m. */
  cloudBase?: Auto<number>;
  cloudTop?: Auto<number>;
  /** J/kg */
  cape?: Auto<number>;
  /** Optical depth of the low layer. */
  opticalDepth?: Auto<number>;
  parallax?: Auto<number>;
  quality?: Auto<QualityTier>;
}

/** Overrides that make it precipitate (they bring a deck to fall from). */
const PRECIP_KEYS = [
  "rain", "snow", "drizzle", "showers", "thunder", "hail", "freezing", "grains",
] satisfies (keyof SceneOverrides)[];

/** The on/off override keys (debug-menu toggles). */
export type BoolOverrideKey = {
  [K in keyof SceneOverrides]-?: NonNullable<SceneOverrides[K]> extends Auto<boolean> ? K : never;
}[keyof SceneOverrides];

function isSet<T>(override: Auto<T> | undefined): override is T {
  return override !== undefined && override !== "auto";
}

function pick<T>(override: Auto<T> | undefined, base: T): T {
  return isSet(override) ? override : base;
}

/** A pinned value, or null for "auto" — the view pins (quality, parallax) the scene resolves itself. */
export function pinned<T>(override: Auto<T> | undefined): T | null {
  return isSet(override) ? override : null;
}

/** Resolves hour/date overrides to an instant in the location's timezone. */
function resolveTime(o: SceneOverrides, timezone: string): number | null {
  if (!isSet(o.hour) && !isSet(o.date)) return null;
  let dt = DateTime.now().setZone(timezone);
  if (isSet(o.date)) {
    const d = DateTime.fromISO(o.date, { zone: timezone });
    if (d.isValid) dt = dt.set({ year: d.year, month: d.month, day: d.day });
  }
  if (isSet(o.hour)) {
    const h = clamp(o.hour, 0, 24);
    const hour = Math.floor(h);
    const minute = Math.round((h - hour) * 60);
    dt = dt.startOf("day").plus({ hours: hour, minutes: minute });
  }
  return dt.toMillis();
}

/** Rates and flags with the pins applied; a flag pinned on with no rate still shows something. */
function precipFromOverrides(base: SceneParams, o: SceneOverrides, temperatureC: number): PrecipState {
  // Measured weather (e.g. dry thundersnow) keeps its rates.
  const pinnedOn = (v: Auto<boolean> | undefined) => isSet(v) && v;
  let baseRain = base.precip.rainMmH;
  if (baseRain === 0 && !isSet(o.snow)) {
    if (pinnedOn(o.thunder) || pinnedOn(o.hail)) baseRain = 6;
    else if (pinnedOn(o.drizzle)) baseRain = 0.5;
    else if (pinnedOn(o.freezing)) baseRain = 2;
  }
  let baseSnow = base.precip.snowCmH;
  if (baseSnow === 0 && pinnedOn(o.grains) && !isSet(o.rain)) baseSnow = 0.4;

  return finalizePrecip(Math.max(0, pick(o.rain, baseRain)), Math.max(0, pick(o.snow, baseSnow)), {
    drizzle: pick(o.drizzle, base.precip.drizzle),
    freezing: pick(o.freezing, base.precip.freezing || temperatureC < 0),
    showers: pick(o.showers, base.precip.showers),
    hail: pick(o.hail, base.precip.hail),
    grains: pick(o.grains, base.precip.grains),
  });
}

/** Cloud layers with the pins applied; `touched` when they differ from the model's. */
function cloudsFromOverrides(
  base: SceneParams,
  o: SceneOverrides,
  thunder: boolean,
  precip: PrecipState,
  precipPinned: boolean,
): { clouds: CloudLayers; touched: boolean } {
  let low = pick(o.cloudLow, base.clouds.low);
  // Precipitation pinned in the debug menu brings its deck to fall from.
  // (Measured weather keeps the model's cover — see sceneParams.ts fromWeather.)
  if (!isSet(o.cloudLow) && precipPinned) {
    if (thunder) low = Math.max(low, 0.95);
    else if (precip.rainMmH > 0 || precip.snowCmH > 0) low = Math.max(low, precip.showers ? 0.6 : 0.85);
  }
  const mid = pick(o.cloudMid, base.clouds.mid);
  const high = pick(o.cloudHigh, base.clouds.high);
  const touched = low !== base.clouds.low || isSet(o.cloudMid) || isSet(o.cloudHigh);
  const total = touched
    ? clamp01(1 - (1 - low) * (1 - mid * 0.8) * (1 - high * 0.4))
    : base.clouds.total;
  return { clouds: { total, low, mid, high }, touched };
}

export function applyOverrides(base: SceneParams, o: SceneOverrides): SceneParams {
  const thunder = pick(o.thunder, base.thunder);
  const temperatureC = pick(o.temperature, base.temperatureC);
  const precip = precipFromOverrides(base, o, temperatureC);
  const precipPinned = PRECIP_KEYS.some((k) => isSet(o[k]));
  const { clouds, touched: layersTouched } = cloudsFromOverrides(base, o, thunder, precip, precipPinned);

  const rime = pick(o.rime, base.fog.rime);
  let visibilityM = pick(o.visibility, base.fog.visibilityM);
  if (rime && !isSet(o.visibility)) visibilityM = Math.min(visibilityM, RIME_VISIBILITY_M);

  const speedMs = Math.max(0, pick(o.windSpeed, base.wind.speedMs));
  const wind = {
    speedMs,
    gustMs: Math.max(speedMs, pick(o.windGust, base.wind.gustMs)),
    fromDeg: pick(o.windFrom, base.wind.fromDeg),
  };
  const humidity = clamp01(pick(o.humidity, base.humidity));
  // Keep the dew-point spread consistent when temperature/humidity are pinned.
  const dewPointC =
    isSet(o.temperature) || isSet(o.humidity)
      ? dewPointFromHumidity(temperatureC, humidity)
      : base.dewPointC;

  // The model's radiation and winds aloft describe the REAL sky — drop them
  // when the debug menu reshapes the weather, so the physics stays coherent.
  // Every precipitation pin counts: each can change the rate, and with it τ.
  const skyTouched = layersTouched || precipPinned || isSet(o.visibility) || isSet(o.rime);
  const windTouched = isSet(o.windSpeed) || isSet(o.windFrom);
  const atmosphere =
    base.atmosphere && windTouched
      ? { ...base.atmosphere, windLow: undefined, windHigh: undefined }
      : base.atmosphere;
  const scene: Omit<SceneParams, "cloudPhysics"> = {
    time: resolveTime(o, base.timezone),
    lat: base.lat,
    lon: base.lon,
    timezone: base.timezone,
    clouds,
    wind,
    precip,
    thunder,
    fog: { visibilityM, rime },
    temperatureC,
    dewPointC,
    humidity,
    atmosphere,
  };
  return {
    ...scene,
    cloudPhysics: physicsFor(scene, !skyTouched, {
      baseM: isSet(o.cloudBase) ? o.cloudBase : undefined,
      topM: isSet(o.cloudTop) ? o.cloudTop : undefined,
      cape: isSet(o.cape) ? o.cape : undefined,
      opticalDepth: isSet(o.opticalDepth) ? o.opticalDepth : undefined,
    }),
  };
}
