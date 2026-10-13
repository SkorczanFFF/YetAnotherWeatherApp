/**
 * The WMO weather codes Open-Meteo returns (a subset of the 0–99 table):
 * label, precipitation kind and intensity, flags, cloud-cover fallback.
 * The one lookup for the scene, the labels and the icons.
 */

export type Intensity = "light" | "moderate" | "heavy";
type CodeKind = "clear" | "fog" | "drizzle" | "rain" | "snow" | "thunder";

export interface CodeInfo {
  label: string;
  kind: CodeKind;
  intensity: Intensity;
  /** Cloud cover to assume when the API sends none, 0..1. */
  cover: number;
  freezing?: boolean;
  showers?: boolean;
  hail?: boolean;
  /** Snow grains (77). */
  grains?: boolean;
  /** Depositing rime fog (48). */
  rime?: boolean;
}

/** WMO definition of fog: visibility under 1 km. */
export const FOG_VISIBILITY_M = 1000;

/** Cloud cover assumed under any precipitation code. */
const WET = 0.85;

const CODES: Record<number, CodeInfo> = {
  0: { label: "Clear sky", kind: "clear", intensity: "light", cover: 0 },
  1: { label: "Mainly clear", kind: "clear", intensity: "light", cover: 0.2 },
  2: { label: "Partly cloudy", kind: "clear", intensity: "moderate", cover: 0.55 },
  3: { label: "Overcast", kind: "clear", intensity: "heavy", cover: 0.95 },
  45: { label: "Fog", kind: "fog", intensity: "moderate", cover: 0.9 },
  48: { label: "Depositing rime fog", kind: "fog", intensity: "moderate", cover: 0.9, rime: true },
  51: { label: "Light drizzle", kind: "drizzle", intensity: "light", cover: WET },
  53: { label: "Moderate drizzle", kind: "drizzle", intensity: "moderate", cover: WET },
  55: { label: "Dense drizzle", kind: "drizzle", intensity: "heavy", cover: WET },
  56: { label: "Light freezing drizzle", kind: "drizzle", intensity: "light", cover: WET, freezing: true },
  57: { label: "Dense freezing drizzle", kind: "drizzle", intensity: "heavy", cover: WET, freezing: true },
  61: { label: "Slight rain", kind: "rain", intensity: "light", cover: WET },
  63: { label: "Moderate rain", kind: "rain", intensity: "moderate", cover: WET },
  65: { label: "Heavy rain", kind: "rain", intensity: "heavy", cover: WET },
  66: { label: "Light freezing rain", kind: "rain", intensity: "light", cover: WET, freezing: true },
  67: { label: "Heavy freezing rain", kind: "rain", intensity: "heavy", cover: WET, freezing: true },
  71: { label: "Slight snow fall", kind: "snow", intensity: "light", cover: WET },
  73: { label: "Moderate snow fall", kind: "snow", intensity: "moderate", cover: WET },
  75: { label: "Heavy snow fall", kind: "snow", intensity: "heavy", cover: WET },
  77: { label: "Snow grains", kind: "snow", intensity: "light", cover: WET, grains: true },
  80: { label: "Slight rain showers", kind: "rain", intensity: "light", cover: WET, showers: true },
  81: { label: "Moderate rain showers", kind: "rain", intensity: "moderate", cover: WET, showers: true },
  82: { label: "Violent rain showers", kind: "rain", intensity: "heavy", cover: WET, showers: true },
  85: { label: "Slight snow showers", kind: "snow", intensity: "light", cover: WET, showers: true },
  86: { label: "Heavy snow showers", kind: "snow", intensity: "heavy", cover: WET, showers: true },
  95: { label: "Thunderstorm", kind: "thunder", intensity: "light", cover: WET, showers: true },
  96: { label: "Thunderstorm with slight hail", kind: "thunder", intensity: "moderate", cover: WET, showers: true, hail: true },
  99: { label: "Thunderstorm with heavy hail", kind: "thunder", intensity: "heavy", cover: WET, showers: true, hail: true },
};

const UNKNOWN: CodeInfo = { label: "Unknown", kind: "clear", intensity: "light", cover: 0.6 };

export const codeInfo = (code: number): CodeInfo => CODES[Math.floor(code)] ?? UNKNOWN;

/**
 * The 15-min weather_code is the step of the coming hour while cloud_cover is
 * interpolated, so pure cloud codes 0–3 are re-derived from the shown cover with
 * Open-Meteo's thresholds; fog, precipitation and storm codes stay.
 */
export const codeForCover = (code: number, coverPct: number | undefined): number =>
  code > 3 || typeof coverPct !== "number"
    ? code
    : coverPct < 20 ? 0 : coverPct < 50 ? 1 : coverPct < 80 ? 2 : 3;
