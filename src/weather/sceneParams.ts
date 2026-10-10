/** WeatherData + units + debug overrides → SceneParams (continuous values, SI units, no React). */

import { DateTime } from "luxon";
import * as SunCalc from "suncalc";
import type { Intensity, Units, WeatherData } from "./types";
import {
  getCloudCoverFromWeatherCode,
  getEffectTypeAndIntensity,
} from "./codes";

export type QualityTier = "low" | "medium" | "high";
export type Auto<T> = T | "auto";

export interface CloudLayers {
  /** All values 0..1. */
  total: number;
  low: number;
  mid: number;
  high: number;
}

export interface PrecipState {
  /** Liquid precipitation (rain + showers), mm/h. */
  rainMmH: number;
  /** Snowfall, cm/h. Both > 0 = sleet. */
  snowCmH: number;
  /** WMO 51–57 — small, slow, dense drops. */
  drizzle: boolean;
  /** WMO 56/57/66/67, or liquid below 0 °C — glaze. */
  freezing: boolean;
  /** Convective (80–86, 95–99) — towering cumulus, pulsing intensity. */
  showers: boolean;
  /** WMO 87–90, 96, 99. */
  hail: boolean;
  /** WMO 77 — snow grains instead of flakes. */
  grains: boolean;
}

export interface SceneParams {
  /** Fixed instant (unix ms) when pinned by debug; null = follow the real clock. */
  time: number | null;
  lat: number;
  lon: number;
  timezone: string;
  clouds: CloudLayers;
  wind: {
    speedMs: number;
    gustMs: number;
    /** Compass bearing the wind blows FROM (0 = N, 90 = E). */
    fromDeg: number;
  };
  precip: PrecipState;
  thunder: boolean;
  fog: {
    visibilityM: number;
    /** WMO 48 / freezing fog — rime frost on the "window". */
    rime: boolean;
  };
  temperatureC: number;
  /** 0..1 */
  humidity: number;
  parallaxAmount: number;
  /** null = auto (device + PerformanceMonitor decide). */
  quality: QualityTier | null;
}

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
  parallax?: Auto<number>;
  quality?: Auto<QualityTier>;
}

/** Single source of truth for "is a simulated state active" — extend when adding a key. */
export const OVERRIDE_KEYS: (keyof SceneOverrides)[] = [
  "hour",
  "date",
  "cloudLow",
  "cloudMid",
  "cloudHigh",
  "windSpeed",
  "windGust",
  "windFrom",
  "rain",
  "snow",
  "drizzle",
  "freezing",
  "showers",
  "hail",
  "grains",
  "thunder",
  "visibility",
  "rime",
  "temperature",
  "humidity",
  "parallax",
  "quality",
];

export function isOverridesDirty(overrides: SceneOverrides | null): boolean {
  if (!overrides) return false;
  return OVERRIDE_KEYS.some((k) => isSet(overrides[k]));
}

function isSet<T>(override: Auto<T> | undefined): override is T {
  return override !== undefined && override !== "auto";
}

function pick<T>(override: Auto<T> | undefined, base: T): T {
  return isSet(override) ? override : base;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fallbacks when the code says it's precipitating but the gauge reads 0. */
const FALLBACK_RAIN_MM_H: Record<Intensity, number> = {
  light: 0.8,
  moderate: 3,
  heavy: 8,
};
const FALLBACK_DRIZZLE_MM_H: Record<Intensity, number> = {
  light: 0.2,
  moderate: 0.5,
  heavy: 1,
};
const FALLBACK_SNOW_CM_H: Record<Intensity, number> = {
  light: 0.5,
  moderate: 1.5,
  heavy: 4,
};
/** Open-Meteo converts snow water equivalent with 0.7 cm per mm. */
const SNOW_CM_PER_MM = 0.7;

/** Upper bound on visibility for fog codes — the API reading is often optimistic. */
const FOG_MAX_VISIBILITY_M: Record<Intensity, number> = {
  light: 1500,
  moderate: 700,
  heavy: 300,
};

export const CLEAR_VISIBILITY_M = 24000;

/** Katowice — matches the app's initial query so the first frame isn't at (0, 0). */
const DEFAULT_LOCATION = { lat: 50.26, lon: 19.02 };

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const DRY: PrecipState = {
  rainMmH: 0,
  snowCmH: 0,
  drizzle: false,
  freezing: false,
  showers: false,
  hail: false,
  grains: false,
};

const DEFAULT_PARAMS: SceneParams = {
  time: null,
  lat: DEFAULT_LOCATION.lat,
  lon: DEFAULT_LOCATION.lon,
  timezone: browserTimezone(),
  clouds: { total: 0.3, low: 0.2, mid: 0.3, high: 0.2 },
  wind: { speedMs: 3, gustMs: 5, fromDeg: 270 },
  precip: DRY,
  thunder: false,
  fog: { visibilityM: CLEAR_VISIBILITY_M, rime: false },
  temperatureC: 12,
  humidity: 0.6,
  parallaxAmount: 0.15,
  quality: null,
};

interface CodeTraits {
  intensity: Intensity;
  liquid: boolean;
  frozen: boolean;
  thunder: boolean;
  fog: boolean;
  drizzle: boolean;
  freezing: boolean;
  showers: boolean;
  hail: boolean;
  grains: boolean;
  rime: boolean;
}

/** WMO code → visual traits. Covers the full 0–99 table, not just Open-Meteo's subset. */
function getCodeTraits(code: number): CodeTraits {
  const c = Math.floor(code);
  const { type, intensity } = getEffectTypeAndIntensity(c);
  return {
    intensity,
    liquid: type === "rain" || type === "thunderstorm",
    frozen: type === "snow",
    thunder: type === "thunderstorm",
    fog: type === "fog",
    drizzle: c >= 51 && c <= 57,
    freezing: c === 56 || c === 57 || c === 66 || c === 67,
    showers: (c >= 80 && c <= 90) || c >= 95,
    hail: (c >= 87 && c <= 90) || c === 96 || c === 99,
    grains: c === 77,
    rime: c === 48,
  };
}

function toMetresPerSecond(speed: number, units: Units): number {
  return units === "imperial" ? speed * 0.44704 : speed / 3.6;
}

function toCelsius(temp: number, units: Units): number {
  return units === "imperial" ? ((temp - 32) * 5) / 9 : temp;
}

function precipFromWeather(
  weather: WeatherData,
  traits: CodeTraits,
  temperatureC: number,
): PrecipState {
  const gaugeTotal = Math.max(0, weather.precipitation ?? 0);
  const hasSplit =
    weather.rain !== undefined ||
    weather.showers !== undefined ||
    weather.snowfall !== undefined;

  let rainMmH = hasSplit
    ? Math.max(0, (weather.rain ?? 0) + (weather.showers ?? 0))
    : traits.liquid
      ? gaugeTotal
      : 0;
  let snowCmH = hasSplit
    ? Math.max(0, weather.snowfall ?? 0)
    : traits.frozen
      ? gaugeTotal * SNOW_CM_PER_MM
      : 0;

  // Code says it's falling but the gauge rounded to 0 — use typical rates.
  if (traits.liquid && rainMmH === 0 && snowCmH === 0) {
    rainMmH = (traits.drizzle ? FALLBACK_DRIZZLE_MM_H : FALLBACK_RAIN_MM_H)[
      traits.intensity
    ];
  }
  if (traits.frozen && snowCmH === 0 && rainMmH === 0) {
    snowCmH = FALLBACK_SNOW_CM_H[traits.intensity] * (traits.grains ? 0.3 : 1);
  }
  // Code says dry but the gauge disagrees with no split available — trust the gauge.
  if (!traits.liquid && !traits.frozen && !hasSplit && gaugeTotal > 0.05) {
    if (temperatureC < 0.5) snowCmH = gaugeTotal * SNOW_CM_PER_MM;
    else rainMmH = gaugeTotal;
  }

  return {
    rainMmH,
    snowCmH,
    drizzle: traits.drizzle && rainMmH > 0,
    freezing: rainMmH > 0 && (traits.freezing || temperatureC < 0),
    showers: traits.showers,
    hail: traits.hail,
    grains: traits.grains,
  };
}

function fromWeather(weather: WeatherData, units: Units): SceneParams {
  const traits = getCodeTraits(weather.weather_code);
  const temperatureC = toCelsius(weather.temp, units);

  const total =
    typeof weather.cloud_cover === "number"
      ? clamp01(weather.cloud_cover / 100)
      : getCloudCoverFromWeatherCode(weather.weather_code);
  const layer = (v: number | undefined, fallback: number) =>
    typeof v === "number" ? clamp01(v / 100) : fallback;
  const clouds: CloudLayers = {
    total,
    low: layer(weather.cloud_cover_low, total),
    mid: layer(weather.cloud_cover_mid, total),
    high: layer(weather.cloud_cover_high, total * 0.5),
  };

  const speedMs = toMetresPerSecond(weather.speed ?? 0, units);
  const gustMs = Math.max(
    speedMs,
    toMetresPerSecond(weather.wind_gusts ?? weather.speed ?? 0, units),
  );

  let visibilityM = weather.visibility ?? CLEAR_VISIBILITY_M;
  if (traits.fog) {
    visibilityM = Math.min(visibilityM, FOG_MAX_VISIBILITY_M[traits.intensity]);
  }

  return {
    time: null,
    lat: weather.lat ?? DEFAULT_LOCATION.lat,
    lon: weather.lon ?? DEFAULT_LOCATION.lon,
    timezone: weather.timezone || browserTimezone(),
    clouds,
    wind: { speedMs, gustMs, fromDeg: weather.wind_direction ?? 0 },
    precip: precipFromWeather(weather, traits, temperatureC),
    thunder: traits.thunder,
    fog: {
      visibilityM,
      rime: traits.rime || (traits.fog && temperatureC < 0),
    },
    temperatureC,
    humidity: clamp01((weather.humidity ?? 60) / 100),
    parallaxAmount: DEFAULT_PARAMS.parallaxAmount,
    quality: null,
  };
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
    const h = Math.min(24, Math.max(0, o.hour));
    const hour = Math.floor(h);
    const minute = Math.round((h - hour) * 60);
    dt = dt.startOf("day").plus({ hours: hour, minutes: minute });
  }
  return dt.toMillis();
}

function applyOverrides(base: SceneParams, o: SceneOverrides): SceneParams {
  const thunder = pick(o.thunder, base.thunder);
  const hail = pick(o.hail, base.precip.hail);
  const drizzle = pick(o.drizzle, base.precip.drizzle);
  const grains = pick(o.grains, base.precip.grains);
  const showers = pick(o.showers, base.precip.showers);

  // Pinning a precipitation flag without a rate should still show something.
  let baseRain = base.precip.rainMmH;
  if (baseRain === 0 && !isSet(o.snow)) {
    if (thunder || hail) baseRain = 6;
    else if (drizzle) baseRain = 0.5;
    else if (isSet(o.freezing) && o.freezing) baseRain = 2;
  }
  let baseSnow = base.precip.snowCmH;
  if (baseSnow === 0 && grains && !isSet(o.rain)) baseSnow = 0.4;

  const rainMmH = Math.max(0, pick(o.rain, baseRain));
  const snowCmH = Math.max(0, pick(o.snow, baseSnow));
  const temperatureC = pick(o.temperature, base.temperatureC);
  const precipitating = rainMmH > 0 || snowCmH > 0;

  let low = pick(o.cloudLow, base.clouds.low);
  // Precipitation needs a cloud deck to fall from; bump it unless pinned.
  if (!isSet(o.cloudLow)) {
    if (thunder) low = Math.max(low, 0.95);
    else if (precipitating) low = Math.max(low, showers ? 0.6 : 0.85);
  }
  const mid = pick(o.cloudMid, base.clouds.mid);
  const high = pick(o.cloudHigh, base.clouds.high);
  const layersTouched =
    low !== base.clouds.low || isSet(o.cloudMid) || isSet(o.cloudHigh);
  const total = layersTouched
    ? clamp01(1 - (1 - low) * (1 - mid * 0.8) * (1 - high * 0.4))
    : base.clouds.total;

  const rime = pick(o.rime, base.fog.rime);
  let visibilityM = pick(o.visibility, base.fog.visibilityM);
  if (rime && !isSet(o.visibility)) visibilityM = Math.min(visibilityM, 400);

  const speedMs = Math.max(0, pick(o.windSpeed, base.wind.speedMs));

  return {
    time: resolveTime(o, base.timezone),
    lat: base.lat,
    lon: base.lon,
    timezone: base.timezone,
    clouds: { total, low, mid, high },
    wind: {
      speedMs,
      gustMs: Math.max(speedMs, pick(o.windGust, base.wind.gustMs)),
      fromDeg: pick(o.windFrom, base.wind.fromDeg),
    },
    precip: {
      rainMmH,
      snowCmH,
      drizzle: drizzle && rainMmH > 0,
      freezing:
        rainMmH > 0 &&
        pick(o.freezing, base.precip.freezing || temperatureC < 0),
      showers,
      hail,
      grains: grains && snowCmH > 0,
    },
    thunder,
    fog: { visibilityM, rime },
    temperatureC,
    humidity: clamp01(pick(o.humidity, base.humidity)),
    parallaxAmount: pick(o.parallax, base.parallaxAmount),
    quality: pick<QualityTier | null>(o.quality, base.quality),
  };
}

export function mapToSceneParams(
  weather: WeatherData | null,
  units: Units,
  overrides: SceneOverrides | null | undefined,
): SceneParams {
  const base = weather ? fromWeather(weather, units) : DEFAULT_PARAMS;
  return overrides ? applyOverrides(base, overrides) : base;
}

/** Sun altitude (radians) at the given instant and location. */
export function getSunAltitude(timeMs: number, lat: number, lon: number): number {
  return SunCalc.getPosition(new Date(timeMs), lat, lon).altitude;
}

/** Night = sun more than ~2° below the horizon (civil twilight has mostly faded). */
export function isNightAt(timeMs: number, lat: number, lon: number): boolean {
  return getSunAltitude(timeMs, lat, lon) < -0.035;
}

/** Frost overlay strength: 0 at ≥ 0 °C, 0.25 just below, 1 at −15 °C; glaze/rime force a visible minimum. */
export function getFrostAmount(params: SceneParams): number {
  const t = params.temperatureC;
  const cold = t < 0 ? 0.25 + 0.75 * clamp01(-t / 15) : 0;
  const glaze = params.precip.freezing || params.fog.rime ? 0.45 : 0;
  return Math.max(cold, glaze);
}
