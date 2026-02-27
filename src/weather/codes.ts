/**
 * WMO/Open-Meteo weather code 0–99 → effect type and intensity.
 * Clear (0–3) has distinct intensity: light (0,1), moderate (2), heavy (3).
 * Every code 0–99 returns a valid result; unknown codes default to clear/light.
 */

import type { EffectType, Intensity } from "./types";

export type { EffectType, Intensity };

export function getEffectTypeAndIntensity(code: number): {
  type: EffectType;
  intensity: Intensity;
} {
  const c = Math.floor(code);
  if (c < 0 || c > 99) return { type: "clear", intensity: "light" };

  // Thunderstorm 95–99
  if (c >= 95) {
    const intensity: Intensity =
      c >= 99 ? "heavy" : c >= 96 ? "moderate" : "light";
    return { type: "thunderstorm", intensity };
  }
  // Hail / thunder mix 87–94
  if (c >= 87)
    return {
      type: c >= 91 ? "thunderstorm" : "rain",
      intensity: c >= 89 && c <= 90 ? "heavy" : "moderate",
    };
  // Snow showers 85–86
  if (c >= 85) return { type: "snow", intensity: c === 86 ? "heavy" : "light" };
  // Rain showers 80–82, mixed 83–84
  if (c >= 80) {
    if (c <= 82) {
      const intensity: Intensity =
        c >= 82 ? "heavy" : c >= 81 ? "moderate" : "light";
      return { type: "rain", intensity };
    }
    return { type: "rain", intensity: "moderate" };
  }
  // Snow 70–79
  if (c >= 70) {
    const intensity: Intensity =
      c >= 75 ? "heavy" : c >= 73 ? "moderate" : "light";
    return { type: "snow", intensity };
  }
  // Freezing rain 66–69
  if (c >= 66) {
    if (c <= 67)
      return { type: "rain", intensity: c >= 67 ? "heavy" : "light" };
    return { type: "rain", intensity: c >= 69 ? "heavy" : "moderate" };
  }
  // Rain 61–65
  if (c >= 61) {
    const intensity: Intensity =
      c >= 65 ? "heavy" : c >= 63 ? "moderate" : "light";
    return { type: "rain", intensity };
  }
  // Drizzle 51–57, 58–60 reserved
  if (c >= 51) {
    if (c <= 57) {
      const intensity: Intensity =
        c >= 55 || c === 57 ? "heavy" : c >= 53 ? "moderate" : "light";
      return { type: "rain", intensity };
    }
    return { type: "rain", intensity: "light" };
  }
  // Fog 45, 48, 40, 30–35
  if (c === 45 || c === 48) return { type: "fog", intensity: "moderate" };
  if (c === 40) return { type: "fog", intensity: "light" };
  if (c >= 30 && c <= 35) return { type: "fog", intensity: "moderate" };
  // 41–44, 46–47, 49–50: fog or rain (45, 48 already handled)
  if (c >= 41 && c <= 50) {
    if (c <= 44) return { type: "fog", intensity: "light" };
    return { type: "rain", intensity: "light" };
  }
  // Blowing snow/sand 36–39
  if (c >= 36) return { type: "snow", intensity: "heavy" };
  // Past weather / blowing 27–29
  if (c >= 27) return { type: "snow", intensity: "moderate" };
  // Past weather 20–26
  if (c >= 20) {
    if (c === 20) return { type: "fog", intensity: "moderate" };
    if (c === 21 || c === 22) return { type: "rain", intensity: "light" };
    if (c === 23) return { type: "rain", intensity: "moderate" };
    if (c === 24) return { type: "snow", intensity: "moderate" };
    if (c === 25) return { type: "rain", intensity: "moderate" };
    if (c === 26) return { type: "thunderstorm", intensity: "light" };
    return { type: "snow", intensity: "moderate" };
  }
  // Mist, diamond dust, etc. 10–19
  if (c >= 10) {
    if (c === 10) return { type: "fog", intensity: "light" };
    if (c === 11) return { type: "snow", intensity: "light" };
    return { type: "clear", intensity: "light" };
  }
  // 4–9 haze / obscuration
  if (c >= 4) return { type: "clear", intensity: "light" };
  // Clear 0–3: intensity = sky state
  const intensity: Intensity =
    c <= 1 ? "light" : c === 2 ? "moderate" : "heavy";
  return { type: "clear", intensity };
}

export const PARTICLE_COUNTS: Record<Intensity, number> = {
  light: 1600,
  moderate: 2000,
  heavy: 4500,
};

export function getParticleCountForIntensity(intensity: Intensity): number {
  return PARTICLE_COUNTS[intensity];
}

export const FOG_DENSITIES: Record<Intensity, number> = {
  light: 0.025,
  moderate: 0.055,
  heavy: 0.1,
};

/**
 * Cloud cover 0–1 from weather code. Handles all codes 0–99.
 */
export function getCloudCoverFromWeatherCode(weatherCode: number): number {
  const c = Math.floor(weatherCode);
  if (c >= 0 && c <= 3) return [0, 0.2, 0.55, 0.95][c];
  if (c === 45 || c === 48 || (c >= 30 && c <= 35) || c === 40) return 0.9;
  if (c >= 4 && c <= 5) return 0.3;
  if (c >= 10 && c <= 19) return 0.4;
  if (c >= 20 && c <= 29) return 0.7;
  if (c >= 36 && c <= 39) return 0.8;
  if (
    (c >= 41 && c <= 50) ||
    (c >= 51 && c <= 67) ||
    (c >= 71 && c <= 79) ||
    (c >= 80 && c <= 86) ||
    (c >= 87 && c <= 99)
  )
    return 0.85;
  if (c >= 58 && c <= 60) return 0.7;
  return 0.6;
}

export const CLEAR_INTENSITY_TO_CLOUD_COVER: Record<Intensity, number> = {
  light: 0.2,
  moderate: 0.55,
  heavy: 0.95,
};
