/**
 * Maps Open-Meteo weather_code to scene parameters for the weather background.
 * Weather codes: https://open-meteo.com/en/docs#weathervariables
 */

export type WeatherEffectType =
  | "clear"
  | "rain"
  | "snow"
  | "fog"
  | "thunderstorm";

export type WeatherIntensity = "light" | "moderate" | "heavy";

export interface SceneConfig {
  type: WeatherEffectType;
  intensity: WeatherIntensity;
  particleCount: number;
  fogDensity: number;
  thunderstorm: boolean;
  /** 0–1 cloud cover from weather code (0=clear, 1=overcast) */
  cloudCover: number;
}

function getEffectTypeAndIntensity(
  code: number
): { type: WeatherEffectType; intensity: WeatherIntensity } {
  if (code >= 95 && code <= 99) {
    const intensity: WeatherIntensity =
      code >= 99 ? "heavy" : code >= 96 ? "moderate" : "light";
    return { type: "thunderstorm", intensity };
  }
  if (code === 45 || code === 48) return { type: "fog", intensity: "moderate" };
  if (code >= 71 && code <= 77) {
    const intensity: WeatherIntensity =
      code >= 75 ? "heavy" : code >= 73 ? "moderate" : "light";
    return { type: "snow", intensity };
  }
  if (code >= 85 && code <= 86) {
    return { type: "snow", intensity: code === 86 ? "heavy" : "light" };
  }
  if (code >= 61 && code <= 65) {
    const intensity: WeatherIntensity =
      code >= 65 ? "heavy" : code >= 63 ? "moderate" : "light";
    return { type: "rain", intensity };
  }
  if (code >= 51 && code <= 57) {
    const intensity: WeatherIntensity =
      code >= 55 || code === 57 ? "heavy" : code >= 53 ? "moderate" : "light";
    return { type: "rain", intensity };
  }
  if (code >= 66 && code <= 67) {
    return { type: "rain", intensity: code >= 67 ? "heavy" : "light" };
  }
  if (code >= 80 && code <= 82) {
    const intensity: WeatherIntensity =
      code >= 82 ? "heavy" : code >= 81 ? "moderate" : "light";
    return { type: "rain", intensity };
  }
  return { type: "clear", intensity: "light" };
}

const PARTICLE_COUNTS: Record<WeatherIntensity, number> = {
  light: 800,
  moderate: 2000,
  heavy: 4500,
};

const FOG_DENSITIES: Record<WeatherIntensity, number> = {
  light: 0.015,
  moderate: 0.04,
  heavy: 0.08,
};

/**
 * Cloud cover 0–1 from Open-Meteo weather code.
 * Codes 0=clear, 1=mainly clear, 2=partly cloudy, 3=overcast; precipitation implies clouds.
 */
export function getCloudCoverFromWeatherCode(weatherCode: number): number {
  if (weatherCode >= 0 && weatherCode <= 3) {
    return [0, 0.2, 0.55, 0.95][weatherCode];
  }
  if (weatherCode === 45 || weatherCode === 48) return 0.9;
  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 80 && weatherCode <= 82) ||
    (weatherCode >= 85 && weatherCode <= 86) ||
    (weatherCode >= 95 && weatherCode <= 99)
  ) {
    return 0.85;
  }
  return 0.6;
}

/**
 * Returns scene configuration for a given Open-Meteo weather code.
 */
export function getSceneConfigFromWeatherCode(weatherCode: number): SceneConfig {
  const { type, intensity } = getEffectTypeAndIntensity(weatherCode);
  const thunderstorm = type === "thunderstorm";
  const rainOrSnow =
    type === "rain" || type === "snow" || type === "thunderstorm";
  const particleCount = rainOrSnow ? PARTICLE_COUNTS[intensity] : 0;
  const fogDensity = type === "fog" ? FOG_DENSITIES[intensity] : 0;
  const cloudCover = getCloudCoverFromWeatherCode(weatherCode);

  return {
    type,
    intensity,
    particleCount,
    fogDensity,
    thunderstorm,
    cloudCover,
  };
}

/**
 * Sun progress: 0 = sunrise, 0.5 = solar noon, 1 = sunset, then night.
 * Uses dt, sunrise, sunset in seconds (Unix) and timezone for local day.
 */
export function getSunProgress(
  dt: number,
  sunrise: number,
  sunset: number
): number {
  if (dt <= sunrise) return 0;
  if (dt >= sunset) return 1;
  const dayLength = sunset - sunrise;
  const elapsed = dt - sunrise;
  return elapsed / dayLength;
}

/**
 * Phase of day: "night" | "dawn" | "day" | "dusk"
 */
export type TimeOfDayPhase = "night" | "dawn" | "day" | "dusk";

export function getTimeOfDayPhase(
  dt: number,
  sunrise: number,
  sunset: number
): TimeOfDayPhase {
  const dawnWindow = 30 * 60; // 30 min
  const duskWindow = 30 * 60;
  if (dt < sunrise - dawnWindow) return "night";
  if (dt < sunrise + dawnWindow) return "dawn";
  if (dt < sunset - duskWindow) return "day";
  if (dt < sunset + duskWindow) return "dusk";
  return "night";
}

