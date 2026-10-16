/** WeatherData + units → SceneParams (continuous values, SI units, no React); debug overrides in overrides.ts. */

import type { Units, WeatherData } from "./types";
import { codeInfo, fallsLiquid } from "./codes";
import { applyOverrides, type SceneOverrides } from "./overrides";
import { UNITS } from "./units";
import { clamp01 } from "../utils/math";
import { CLEAR_VISIBILITY_M, FOG_MAX_VISIBILITY_M } from "./fog";
import { DRY, precipFromWeather, type PrecipState } from "./precip";
import {
  type AtmosphereSI,
  type CloudPhysics,
  dewPointFromHumidity,
  physicsFor,
  toAtmosphereSI,
} from "./cloudPhysics";

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
}

/** The app's initial location; the scene uses it before the first fetch lands, not (0, 0). */
export const DEFAULT_LOCATION = { name: "Katowice", lat: 50.26, lon: 19.02 };

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const DEFAULT_SCENE: Omit<SceneParams, "cloudPhysics"> = {
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
  dewPointC: 4,
  humidity: 0.6,
  atmosphere: null,
};
const DEFAULT_PARAMS: SceneParams = { ...DEFAULT_SCENE, cloudPhysics: physicsFor(DEFAULT_SCENE, false) };

function fromWeather(weather: WeatherData, units: Units): SceneParams {
  const info = codeInfo(weather.weather_code);
  const fog = info.kind === "fog";
  const { toCelsius, toMs } = UNITS[units];
  const temperatureC = toCelsius(weather.temp);

  const total =
    typeof weather.cloud_cover === "number"
      ? clamp01(weather.cloud_cover / 100)
      : info.cover;
  const layer = (v: number | undefined, fallback: number) =>
    typeof v === "number" ? clamp01(v / 100) : fallback;
  // Rain or a storm needs a few cells to fall from, even when the model's
  // cloud fraction says scattered (it often does for showers).
  const rainMinimum =
    info.kind === "thunder" ? 0.35 : fallsLiquid(info) || info.kind === "snow" ? 0.25 : 0;
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
  if (fog) visibilityM = Math.min(visibilityM, FOG_MAX_VISIBILITY_M);

  const humidity = clamp01((weather.humidity ?? 60) / 100);
  const dewPointC =
    weather.dew_point != null
      ? toCelsius(weather.dew_point)
      : dewPointFromHumidity(temperatureC, humidity);

  const scene: Omit<SceneParams, "cloudPhysics"> = {
    time: null,
    lat: weather.lat,
    lon: weather.lon,
    timezone: weather.timezone || browserTimezone(),
    clouds,
    wind: { speedMs, gustMs, fromDeg: weather.wind_direction ?? 0 },
    precip: precipFromWeather(weather, info, temperatureC),
    thunder: info.kind === "thunder",
    fog: {
      visibilityM,
      rime: !!info.rime || (fog && temperatureC < 0),
    },
    temperatureC,
    dewPointC,
    humidity,
    atmosphere: toAtmosphereSI(weather.atmosphere, units),
  };
  return { ...scene, cloudPhysics: physicsFor(scene, true) };
}

export function mapToSceneParams(
  weather: WeatherData | null,
  units: Units,
  overrides: SceneOverrides | null | undefined,
): SceneParams {
  const base = weather ? fromWeather(weather, units) : DEFAULT_PARAMS;
  return overrides ? applyOverrides(base, overrides) : base;
}
