/** WeatherData + units + debug overrides → SceneParams (continuous values, SI units, no React). */

import { DateTime } from "luxon";
import * as SunCalc from "suncalc";
import type { Intensity, Units, WeatherData } from "./types";
import {
  getCloudCoverFromWeatherCode,
  getEffectTypeAndIntensity,
  isDrizzleCode,
} from "./codes";

export type PrecipKind = "none" | "rain" | "snow";
export type QualityTier = "low" | "medium" | "high";
export type Auto<T> = T | "auto";

export interface CloudLayers {
  /** All values 0..1. */
  total: number;
  low: number;
  mid: number;
  high: number;
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
  precip: { kind: PrecipKind; rateMmH: number; drizzle: boolean };
  thunder: boolean;
  visibilityM: number;
  temperatureC: number;
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
  precipKind?: Auto<PrecipKind>;
  /** mm/h */
  precipRate?: Auto<number>;
  drizzle?: Auto<boolean>;
  thunder?: Auto<boolean>;
  /** metres */
  visibility?: Auto<number>;
  /** °C */
  temperature?: Auto<number>;
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
  "precipKind",
  "precipRate",
  "drizzle",
  "thunder",
  "visibility",
  "temperature",
  "parallax",
  "quality",
];

export function isOverridesDirty(overrides: SceneOverrides | null): boolean {
  if (!overrides) return false;
  return OVERRIDE_KEYS.some((k) => {
    const v = overrides[k];
    return v !== undefined && v !== "auto";
  });
}

function pick<T>(override: Auto<T> | undefined, base: T): T {
  return override !== undefined && override !== "auto" ? override : base;
}

function isSet<T>(override: Auto<T> | undefined): override is T {
  return override !== undefined && override !== "auto";
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fallback rate when the code says it's precipitating but the API rate is 0. */
const FALLBACK_RATE_MM_H: Record<Intensity, number> = {
  light: 0.8,
  moderate: 3,
  heavy: 8,
};

/** Upper bound on visibility for fog codes — the API reading is often optimistic. */
const FOG_MAX_VISIBILITY_M: Record<Intensity, number> = {
  light: 1500,
  moderate: 700,
  heavy: 300,
};

const CLEAR_VISIBILITY_M = 24000;

/** Katowice — matches the app's initial query so the first frame isn't at (0, 0). */
const DEFAULT_LOCATION = { lat: 50.26, lon: 19.02 };

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const DEFAULT_PARAMS: SceneParams = {
  time: null,
  lat: DEFAULT_LOCATION.lat,
  lon: DEFAULT_LOCATION.lon,
  timezone: browserTimezone(),
  clouds: { total: 0.3, low: 0.2, mid: 0.3, high: 0.2 },
  wind: { speedMs: 3, gustMs: 5, fromDeg: 270 },
  precip: { kind: "none", rateMmH: 0, drizzle: false },
  thunder: false,
  visibilityM: CLEAR_VISIBILITY_M,
  temperatureC: 12,
  parallaxAmount: 0.15,
  quality: null,
};

function toMetresPerSecond(speed: number, units: Units): number {
  return units === "imperial" ? speed * 0.44704 : speed / 3.6;
}

function toCelsius(temp: number, units: Units): number {
  return units === "imperial" ? ((temp - 32) * 5) / 9 : temp;
}

function fromWeather(weather: WeatherData, units: Units): SceneParams {
  const { type, intensity } = getEffectTypeAndIntensity(weather.weather_code);
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

  const apiRate = Math.max(0, weather.precipitation ?? 0);
  let kind: PrecipKind =
    type === "rain" || type === "thunderstorm"
      ? "rain"
      : type === "snow"
        ? "snow"
        : "none";
  // Code says dry but the gauge says otherwise — trust the gauge.
  if (kind === "none" && apiRate > 0.05) {
    kind = temperatureC < 0.5 ? "snow" : "rain";
  }
  const rateMmH =
    kind === "none" ? 0 : apiRate > 0 ? apiRate : FALLBACK_RATE_MM_H[intensity];

  const speedMs = toMetresPerSecond(weather.speed ?? 0, units);
  const gustMs = Math.max(
    speedMs,
    toMetresPerSecond(weather.wind_gusts ?? weather.speed ?? 0, units),
  );

  let visibilityM = weather.visibility ?? CLEAR_VISIBILITY_M;
  if (type === "fog") {
    visibilityM = Math.min(visibilityM, FOG_MAX_VISIBILITY_M[intensity]);
  }

  return {
    time: null,
    lat: weather.lat ?? DEFAULT_LOCATION.lat,
    lon: weather.lon ?? DEFAULT_LOCATION.lon,
    timezone: weather.timezone || browserTimezone(),
    clouds,
    wind: { speedMs, gustMs, fromDeg: weather.wind_direction ?? 0 },
    precip: {
      kind,
      rateMmH,
      drizzle: kind === "rain" && isDrizzleCode(weather.weather_code),
    },
    thunder: type === "thunderstorm",
    visibilityM,
    temperatureC,
    parallaxAmount: DEFAULT_PARAMS.parallaxAmount,
    quality: null,
  };
}

/** Resolves hour/date overrides to an instant in the location's timezone. */
function resolveTime(
  o: SceneOverrides,
  timezone: string,
): number | null {
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

export function mapToSceneParams(
  weather: WeatherData | null,
  units: Units,
  overrides: SceneOverrides | null | undefined,
): SceneParams {
  const base = weather ? fromWeather(weather, units) : DEFAULT_PARAMS;
  if (!overrides) return base;
  const o = overrides;

  const thunder = pick(o.thunder, base.thunder);

  let kind = pick(o.precipKind, base.precip.kind);
  // A storm without rain reads wrong — bring rain along unless kind is pinned.
  if (thunder && !isSet(o.precipKind) && kind === "none") kind = "rain";
  const rateMmH =
    kind === "none"
      ? 0
      : pick(
          o.precipRate,
          base.precip.rateMmH > 0 ? base.precip.rateMmH : thunder ? 6 : 2.5,
        );

  let low = pick(o.cloudLow, base.clouds.low);
  // Precipitation needs a cloud deck to fall from; bump it unless pinned.
  if (!isSet(o.cloudLow) && kind !== "none") {
    low = Math.max(low, thunder ? 0.95 : 0.85);
  }
  const mid = pick(o.cloudMid, base.clouds.mid);
  const high = pick(o.cloudHigh, base.clouds.high);
  const layersTouched =
    low !== base.clouds.low || isSet(o.cloudMid) || isSet(o.cloudHigh);
  const total = layersTouched
    ? clamp01(1 - (1 - low) * (1 - mid * 0.8) * (1 - high * 0.4))
    : base.clouds.total;

  const speedMs = pick(o.windSpeed, base.wind.speedMs);

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
      kind,
      rateMmH,
      drizzle: kind === "rain" && pick(o.drizzle, base.precip.drizzle),
    },
    thunder,
    visibilityM: pick(o.visibility, base.visibilityM),
    temperatureC: pick(o.temperature, base.temperatureC),
    parallaxAmount: pick(o.parallax, base.parallaxAmount),
    quality: pick<QualityTier | null>(o.quality, base.quality),
  };
}

/** Sun altitude (radians) at the given instant and location. */
export function getSunAltitude(timeMs: number, lat: number, lon: number): number {
  return SunCalc.getPosition(new Date(timeMs), lat, lon).altitude;
}

/** Night = sun more than ~2° below the horizon (civil twilight has mostly faded). */
export function isNightAt(timeMs: number, lat: number, lon: number): boolean {
  return getSunAltitude(timeMs, lat, lon) < -0.035;
}
