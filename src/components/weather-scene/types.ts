import { WeatherData } from "../../types/weather";
import {
  SceneConfig,
  WeatherEffectType,
  WeatherIntensity,
  TimeOfDayPhase,
} from "./weatherSceneLogic";

export interface DebugOverrides {
  /** When set, overrides weather-driven effect type */
  effectType?: WeatherEffectType | "auto";
  /** When set, overrides intensity */
  intensity?: WeatherIntensity | "auto";
  /** Override particle count (ignored when auto) */
  particleCount?: number | "auto";
  /** Override fog density */
  fogDensity?: number | "auto";
  /** Override time-of-day phase for sky */
  timeOfDay?: TimeOfDayPhase | "auto";
  /** Override wind speed (m/s or same unit as API) */
  windSpeed?: number | "auto";
  /** Override wind direction (degrees) */
  windDirection?: number | "auto";
  /** Camera parallax amount 0..1 */
  parallaxAmount?: number | "auto";
  /** Thunderstorm flash on/off override */
  thunderstorm?: boolean | "auto";
}

export interface WeatherSceneProps {
  weather: WeatherData | null;
  overrides?: DebugOverrides | null;
}

/** Resolved config: weather + overrides applied */
export interface ResolvedSceneConfig extends SceneConfig {
  windSpeed: number;
  windDirection: number;
  timeOfDay: TimeOfDayPhase;
  parallaxAmount: number;
}
