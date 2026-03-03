/** WeatherData + overrides → SimulationConfig; time-of-day and config mapping (no component deps). */

import type { WeatherData } from "./types";
import type { SimulationConfig, TimeOfDay } from "./types";
import type { Intensity } from "./codes";
import {
  getEffectTypeAndIntensity,
  getCloudCoverFromWeatherCode,
  getParticleCountForIntensity,
  FOG_DENSITIES,
  CLEAR_INTENSITY_TO_CLOUD_COVER,
  isDrizzleCode,
} from "./codes";

function computeFogDensityFromHumidity(
  humidity: number,
  intensity: Intensity,
): number {
  const clamped = Math.min(Math.max(humidity, 0), 100);
  const factor = 0.7 + (clamped / 100) * 0.6;
  return FOG_DENSITIES[intensity] * factor;
}

export type { SimulationConfig, TimeOfDay };

/** Phase of day for sky and logic. */
export type TimeOfDayPhase = TimeOfDay;

export function getTimeOfDayPhase(
  dt: number,
  sunrise: number,
  sunset: number,
): TimeOfDayPhase {
  const dawnWindow = 30 * 60;
  const duskWindow = 30 * 60;
  if (dt < sunrise - dawnWindow) return "night";
  if (dt < sunrise + dawnWindow) return "dawn";
  if (dt < sunset - duskWindow) return "day";
  if (dt < sunset + duskWindow) return "dusk";
  return "night";
}

export function getSunProgress(
  dt: number,
  sunrise: number,
  sunset: number,
): number {
  if (dt <= sunrise) return 0;
  if (dt >= sunset) return 1;
  const dayLength = sunset - sunrise;
  const elapsed = dt - sunrise;
  return elapsed / dayLength;
}

/** Debug overrides. "auto" = use weather-driven value. */
export interface DebugOverrides {
  effectType?: SimulationConfig["effectType"] | "auto";
  intensity?: SimulationConfig["intensity"] | "auto";
  particleCount?: number | "auto";
  fogDensity?: number | "auto";
  timeOfDay?: TimeOfDayPhase | "auto";
  cloudCover?: number | "auto";
  cloudCount?: number | "auto";
  windSpeed?: number | "auto";
  windDirection?: number | "auto";
  parallaxAmount?: number | "auto";
  temperature?: number | "auto";
  humidity?: number | "auto";
}

const DEFAULT_CONFIG: SimulationConfig = {
  effectType: "clear",
  intensity: "light",
  particleCount: 0,
  fogDensity: 0,
  thunderstorm: false,
  cloudCover: 0.4,
  windSpeed: 0,
  windDirection: 0,
  timeOfDay: "day",
  parallaxAmount: 0.15,
  sunrise: 0,
  sunset: 0,
  useRealtimeClock: false,
  isDrizzle: false,
};

export function mapToSimulationConfig(
  weather: WeatherData | null,
  overrides: DebugOverrides | null | undefined,
): SimulationConfig {
  const base = weather
    ? (() => {
        const { type, intensity } = getEffectTypeAndIntensity(
          weather.weather_code,
        );
        const phase = getTimeOfDayPhase(
          weather.dt,
          weather.sunrise,
          weather.sunset,
        );
        const thunderstorm = type === "thunderstorm";
        const rainOrSnow =
          type === "rain" || type === "snow" || type === "thunderstorm";
        const particleCount = rainOrSnow
          ? getParticleCountForIntensity(intensity)
          : 0;
        const fogDensity =
          type === "fog"
            ? computeFogDensityFromHumidity(weather.humidity ?? 100, intensity)
            : 0;
        const cloudCover = getCloudCoverFromWeatherCode(weather.weather_code);
        const isDrizzle =
          type === "rain" && isDrizzleCode(weather.weather_code);
        return {
          effectType: type,
          intensity,
          particleCount,
          fogDensity,
          thunderstorm,
          cloudCover,
          windSpeed: weather.speed ?? 0,
          windDirection: weather.wind_direction ?? 0,
          timeOfDay: phase,
          parallaxAmount: 0.15,
          sunrise: weather.sunrise,
          sunset: weather.sunset,
          useRealtimeClock: true,
          temperature: weather.temp,
          humidity: weather.humidity,
          isDrizzle,
        };
      })()
    : DEFAULT_CONFIG;

  if (!overrides) return base;

  const o = overrides;
  const effectType =
    o.effectType && o.effectType !== "auto" ? o.effectType : base.effectType;
  const intensity =
    o.intensity && o.intensity !== "auto" ? o.intensity : base.intensity;
  const needsParticles =
    effectType === "rain" ||
    effectType === "snow" ||
    effectType === "thunderstorm";
  const particleCount =
    o.particleCount !== undefined && o.particleCount !== "auto"
      ? o.particleCount
      : needsParticles && base.particleCount === 0
        ? getParticleCountForIntensity(intensity)
        : base.particleCount;

  const timeOverridden = !!(o.timeOfDay && o.timeOfDay !== "auto");

  let cloudCover = base.cloudCover;
  if (o.cloudCover !== undefined && o.cloudCover !== "auto") {
    cloudCover = o.cloudCover;
  } else if (effectType === "clear" && o.intensity && o.intensity !== "auto") {
    cloudCover = CLEAR_INTENSITY_TO_CLOUD_COVER[o.intensity];
  }

  const fogDensityFromEffect =
    effectType === "fog"
      ? computeFogDensityFromHumidity(base.humidity ?? 100, intensity)
      : base.fogDensity;
  const fogDensity =
    o.fogDensity !== undefined && o.fogDensity !== "auto"
      ? o.fogDensity
      : fogDensityFromEffect;

  const temperature =
    o.temperature !== undefined && o.temperature !== "auto"
      ? o.temperature
      : base.temperature;
  const humidity =
    o.humidity !== undefined && o.humidity !== "auto"
      ? o.humidity
      : base.humidity;

  const isDrizzle = base.isDrizzle ?? false;

  return {
    effectType,
    intensity,
    particleCount,
    fogDensity,
    thunderstorm: effectType === "thunderstorm",
    cloudCover,
    cloudCount:
      o.cloudCount !== undefined && o.cloudCount !== "auto"
        ? o.cloudCount
        : undefined,
    windSpeed:
      o.windSpeed !== undefined && o.windSpeed !== "auto"
        ? o.windSpeed
        : base.windSpeed,
    windDirection:
      o.windDirection !== undefined && o.windDirection !== "auto"
        ? o.windDirection
        : base.windDirection,
    timeOfDay: timeOverridden
      ? (o.timeOfDay as TimeOfDay)
      : base.timeOfDay,
    parallaxAmount:
      o.parallaxAmount !== undefined && o.parallaxAmount !== "auto"
        ? o.parallaxAmount
        : base.parallaxAmount,
    sunrise: base.sunrise,
    sunset: base.sunset,
    useRealtimeClock: timeOverridden ? false : base.useRealtimeClock,
    temperature,
    humidity,
    isDrizzle,
  };
}
