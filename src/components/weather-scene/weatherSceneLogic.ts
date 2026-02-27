/**
 * Re-exports from weather domain; provides getSceneConfigFromWeatherCode for tests/legacy.
 */

import type { EffectType, Intensity } from "../../weather/codes";
import {
  getEffectTypeAndIntensity,
  getCloudCoverFromWeatherCode as getCloudCover,
  getParticleCountForIntensity,
  PARTICLE_COUNTS,
  FOG_DENSITIES,
} from "../../weather/codes";
import { getTimeOfDayPhase, getSunProgress } from "../../weather/config";

export type WeatherEffectType = EffectType;
export type WeatherIntensity = Intensity;
export type TimeOfDayPhase = "night" | "dawn" | "day" | "dusk";

export interface SceneConfig {
  type: EffectType;
  intensity: Intensity;
  particleCount: number;
  fogDensity: number;
  thunderstorm: boolean;
  cloudCover: number;
}

export { getTimeOfDayPhase, getSunProgress, PARTICLE_COUNTS, getParticleCountForIntensity };

export function getCloudCoverFromWeatherCode(weatherCode: number): number {
  return getCloudCover(weatherCode);
}

/** Returns scene configuration for a given Open-Meteo weather code (legacy/tests). */
export function getSceneConfigFromWeatherCode(
  weatherCode: number,
): SceneConfig {
  const { type, intensity } = getEffectTypeAndIntensity(weatherCode);
  const thunderstorm = type === "thunderstorm";
  const rainOrSnow =
    type === "rain" || type === "snow" || type === "thunderstorm";
  const particleCount = rainOrSnow ? PARTICLE_COUNTS[intensity] : 0;
  const fogDensity = type === "fog" ? FOG_DENSITIES[intensity] : 0;
  const cloudCover = getCloudCover(weatherCode);
  return {
    type,
    intensity,
    particleCount,
    fogDensity,
    thunderstorm,
    cloudCover,
  };
}
