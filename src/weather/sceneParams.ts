/** WeatherData + units → SceneParams (continuous values, SI units, no React); debug overrides in overrides.ts. */

import type { Units, WeatherData } from "./types";
import { codeInfo, FOG_VISIBILITY_M, type Intensity } from "./codes";
import { applyOverrides, type SceneOverrides } from "./overrides";
import { UNITS } from "./units";
import { clamp01 } from "../utils/math";
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

export interface CloudLayers {
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
  /** Convective (WMO 80–86, 95–99) — towering cumulus, pulsing intensity. */
  showers: boolean;
  /** WMO 96, 99. */
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
    measuredSky: false,
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
      measuredSky: true,
    }),
    atmosphere,
    parallaxAmount: DEFAULT_PARAMS.parallaxAmount,
    quality: null,
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
