/** WeatherData + units + debug overrides → SceneParams (continuous values, SI units, no React). */

import { DateTime } from "luxon";
import type { Units, WeatherData } from "./types";
import { codeInfo, type Intensity } from "./codes";
import { UNITS } from "./units";
import { clamp, clamp01 } from "../utils/math";
import {
  type AtmosphereSI,
  type CloudPhysics,
  deriveCloudPhysics,
  dewPointFromHumidity,
  toAtmosphereSI,
} from "./cloudPhysics";

/** Quality tiers, lowest first. */
export const QUALITY_TIERS = ["potato", "low", "medium", "high"] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];
export type Auto<T> = T | "auto";

interface CloudLayers {
  /** All values 0..1. */
  total: number;
  low: number;
  mid: number;
  high: number;
}

interface PrecipState {
  /** Liquid precipitation (rain + showers), mm/h. */
  rainMmH: number;
  /** Snowfall, cm/h. Both > 0 = sleet. */
  snowCmH: number;
  /** WMO 51–57 — small, slow, dense drops. */
  drizzle: boolean;
  /** WMO 56/57/66/67, or liquid below 0 °C — glaze. */
  freezing: boolean;
  /** Convective (80–90, 95–99) — towering cumulus, pulsing intensity. */
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
  dewPointC: number;
  /** 0..1 */
  humidity: number;
  /** Base/top/optical depth/convection/winds aloft — see weather/cloudPhysics.ts. */
  cloudPhysics: CloudPhysics;
  /** Upper-air column the physics was derived from (kept to re-derive under overrides). */
  atmosphere: AtmosphereSI | null;
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

/** Every override key; a key missing here (or a stale one) is a type error. */
const OVERRIDE_KEY_SET = {
  hour: 1, date: 1,
  cloudLow: 1, cloudMid: 1, cloudHigh: 1,
  windSpeed: 1, windGust: 1, windFrom: 1,
  rain: 1, snow: 1, drizzle: 1, freezing: 1, showers: 1, hail: 1, grains: 1, thunder: 1,
  visibility: 1, rime: 1, temperature: 1, humidity: 1,
  cloudBase: 1, cloudTop: 1, cape: 1, opticalDepth: 1,
  parallax: 1, quality: 1,
} satisfies Record<keyof SceneOverrides, 1>;
const OVERRIDE_KEYS = Object.keys(OVERRIDE_KEY_SET) as (keyof SceneOverrides)[];

/** Overrides that make it precipitate (they bring a deck to fall from). */
const PRECIP_KEYS = [
  "rain", "snow", "drizzle", "showers", "thunder", "hail", "freezing", "grains",
] satisfies (keyof SceneOverrides)[];

/** The on/off override keys (debug-menu toggles). */
export type BoolOverrideKey = {
  [K in keyof SceneOverrides]-?: NonNullable<SceneOverrides[K]> extends Auto<boolean> ? K : never;
}[keyof SceneOverrides];

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
const FOG_MAX_VISIBILITY_M = 700;
/** WMO definition of fog. */
const FOG_VISIBILITY_M = 1000;
/** Rime needs supercooled fog: caps visibility when only the flag is pinned. */
const RIME_VISIBILITY_M = 400;

export const CLEAR_VISIBILITY_M = 24000;

/** The app's initial location; the scene uses it before the first fetch lands, not (0, 0). */
export const DEFAULT_LOCATION = { name: "Katowice", lat: 50.26, lon: 19.02 };

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

const DEFAULT_CLOUDS: CloudLayers = { total: 0.3, low: 0.2, mid: 0.3, high: 0.2 };
const DEFAULT_WIND = { speedMs: 3, gustMs: 5, fromDeg: 270 };

const DEFAULT_PARAMS: SceneParams = {
  time: null,
  lat: DEFAULT_LOCATION.lat,
  lon: DEFAULT_LOCATION.lon,
  timezone: browserTimezone(),
  clouds: DEFAULT_CLOUDS,
  wind: DEFAULT_WIND,
  precip: DRY,
  thunder: false,
  fog: { visibilityM: CLEAR_VISIBILITY_M, rime: false },
  temperatureC: 12,
  dewPointC: 4,
  humidity: 0.6,
  cloudPhysics: deriveCloudPhysics({
    atmosphere: null,
    temperatureC: 12,
    dewPointC: 4,
    clouds: DEFAULT_CLOUDS,
    surfaceWind: DEFAULT_WIND,
    thunder: false,
    showers: false,
    precipitating: false,
    fog: false,
    trustRadiation: false,
  }),
  atmosphere: null,
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

function getCodeTraits(code: number): CodeTraits {
  const { kind, intensity, freezing, showers, hail, grains, rime } = codeInfo(code);
  return {
    intensity,
    liquid: kind === "rain" || kind === "drizzle" || kind === "thunder",
    frozen: kind === "snow",
    thunder: kind === "thunder",
    fog: kind === "fog",
    drizzle: kind === "drizzle",
    freezing: !!freezing,
    showers: !!showers,
    hail: !!hail,
    grains: !!grains,
    rime: !!rime,
  };
}

function precipFromWeather(
  weather: WeatherData,
  traits: CodeTraits,
  temperatureC: number,
): PrecipState {
  const gaugeTotal = Math.max(0, weather.precipitation ?? 0);
  const hasSplit =
    weather.rain != null || weather.showers != null || weather.snowfall != null;

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
  const { toCelsius, toMs } = UNITS[units];
  const temperatureC = toCelsius(weather.temp);

  const total =
    typeof weather.cloud_cover === "number"
      ? clamp01(weather.cloud_cover / 100)
      : codeInfo(weather.weather_code).cover;
  const layer = (v: number | undefined, fallback: number) =>
    typeof v === "number" ? clamp01(v / 100) : fallback;
  // Rain or a storm needs a few cells to fall from, even when the model's
  // cloud fraction says scattered (it often does for showers).
  const rainMinimum =
    traits.thunder ? 0.35 : traits.liquid || traits.frozen ? 0.25 : 0;
  const clouds: CloudLayers = {
    total,
    low: Math.max(layer(weather.cloud_cover_low, total), rainMinimum),
    mid: layer(weather.cloud_cover_mid, total),
    high: layer(weather.cloud_cover_high, total * 0.5),
  };

  const speedMs = toMs(weather.speed ?? 0);
  const gustMs = Math.max(
    speedMs,
    toMs(weather.wind_gusts ?? weather.speed ?? 0),
  );

  let visibilityM = weather.visibility ?? CLEAR_VISIBILITY_M;
  if (traits.fog) {
    visibilityM = Math.min(visibilityM, FOG_MAX_VISIBILITY_M);
  }

  const humidity = clamp01((weather.humidity ?? 60) / 100);
  const dewPointC =
    weather.dew_point != null
      ? toCelsius(weather.dew_point)
      : dewPointFromHumidity(temperatureC, humidity);
  const precip = precipFromWeather(weather, traits, temperatureC);
  const wind = { speedMs, gustMs, fromDeg: weather.wind_direction ?? 0 };
  const atmosphere = toAtmosphereSI(weather.atmosphere, units);

  return {
    time: null,
    lat: weather.lat ?? DEFAULT_LOCATION.lat,
    lon: weather.lon ?? DEFAULT_LOCATION.lon,
    timezone: weather.timezone || browserTimezone(),
    clouds,
    wind,
    precip,
    thunder: traits.thunder,
    fog: {
      visibilityM,
      rime: traits.rime || (traits.fog && temperatureC < 0),
    },
    temperatureC,
    dewPointC,
    humidity,
    cloudPhysics: deriveCloudPhysics({
      atmosphere,
      temperatureC,
      dewPointC,
      clouds,
      surfaceWind: wind,
      thunder: traits.thunder,
      showers: traits.showers,
      precipitating: precip.rainMmH > 0 || precip.snowCmH > 0,
      fog: traits.fog || visibilityM < FOG_VISIBILITY_M,
      trustRadiation: true,
    }),
    atmosphere,
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
    const h = clamp(o.hour, 0, 24);
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

  // Pinning a precipitation flag without a rate should still show something;
  // measured weather (e.g. dry thundersnow) keeps its rates.
  const pinned = (v: Auto<boolean> | undefined) => isSet(v) && v;
  let baseRain = base.precip.rainMmH;
  if (baseRain === 0 && !isSet(o.snow)) {
    if (pinned(o.thunder) || pinned(o.hail)) baseRain = 6;
    else if (pinned(o.drizzle)) baseRain = 0.5;
    else if (pinned(o.freezing)) baseRain = 2;
  }
  let baseSnow = base.precip.snowCmH;
  if (baseSnow === 0 && pinned(o.grains) && !isSet(o.rain)) baseSnow = 0.4;

  const rainMmH = Math.max(0, pick(o.rain, baseRain));
  const snowCmH = Math.max(0, pick(o.snow, baseSnow));
  const temperatureC = pick(o.temperature, base.temperatureC);
  const precipitating = rainMmH > 0 || snowCmH > 0;

  let low = pick(o.cloudLow, base.clouds.low);
  // Precipitation pinned in the debug menu brings its deck to fall from.
  // (Measured weather keeps the model's cover — see fromWeather.)
  const precipPinned = PRECIP_KEYS.some((k) => isSet(o[k]));
  if (!isSet(o.cloudLow) && precipPinned) {
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
  const clouds: CloudLayers = { total, low, mid, high };

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
  const skyTouched =
    layersTouched ||
    isSet(o.rain) ||
    isSet(o.snow) ||
    isSet(o.thunder) ||
    isSet(o.showers) ||
    isSet(o.visibility);
  const windTouched = isSet(o.windSpeed) || isSet(o.windFrom);
  const atmosphere =
    base.atmosphere && windTouched
      ? { ...base.atmosphere, windLow: undefined, windHigh: undefined }
      : base.atmosphere;
  const cloudPhysics = deriveCloudPhysics({
    atmosphere,
    temperatureC,
    dewPointC,
    clouds,
    surfaceWind: wind,
    thunder,
    showers,
    precipitating,
    fog: visibilityM < FOG_VISIBILITY_M || rime,
    trustRadiation: !skyTouched,
    override: {
      baseM: isSet(o.cloudBase) ? o.cloudBase : undefined,
      topM: isSet(o.cloudTop) ? o.cloudTop : undefined,
      cape: isSet(o.cape) ? o.cape : undefined,
      opticalDepth: isSet(o.opticalDepth) ? o.opticalDepth : undefined,
    },
  });

  return {
    time: resolveTime(o, base.timezone),
    lat: base.lat,
    lon: base.lon,
    timezone: base.timezone,
    clouds,
    wind,
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
    dewPointC,
    humidity,
    cloudPhysics,
    atmosphere,
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

/** Temperature at which the frosted-glass effect reaches full strength, °C. */
const FROST_FULL_AT_C = -20;

/**
 * Frosted-glass strength, 0..1. Grows gradually from 0 °C to −20 °C (eased,
 * so −1 °C is only a hint in the corners), scaled by humidity — dry air
 * frosts the glass less. Freezing rain/drizzle and rime fog glaze the glass
 * even near 0 °C.
 */
export function getFrostAmount(params: SceneParams): number {
  const cold = Math.pow(clamp01(params.temperatureC / FROST_FULL_AT_C), 1.6);
  const moisture = 0.55 + 0.45 * params.humidity;
  const glaze = params.precip.freezing || params.fog.rime ? 0.35 : 0;
  return clamp01(Math.max(cold * moisture, glaze));
}
