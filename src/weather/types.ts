/** Weather domain types (config, codes, simulation). Re-exports app types; defines EffectType, Intensity, TimeOfDay, SimulationConfig. */

export type {
  WeatherData,
  WeatherQuery,
  Units,
  DailyWeather,
} from "../types/weather";

export type EffectType =
  | "clear"
  | "rain"
  | "snow"
  | "fog"
  | "thunderstorm";

export type Intensity = "light" | "moderate" | "heavy";

export type TimeOfDay = "night" | "dawn" | "day" | "dusk";

export interface SimulationConfig {
  effectType: EffectType;
  intensity: Intensity;
  particleCount: number;
  fogDensity: number;
  thunderstorm: boolean;
  cloudCover: number;
  cloudCount?: number;
  windSpeed: number;
  windDirection: number;
  timeOfDay: TimeOfDay;
  parallaxAmount: number;
  sunrise: number;
  sunset: number;
  /** Current time (Unix seconds) for sun/moon position when not using real-time clock. */
  dt?: number;
  useRealtimeClock: boolean;
  temperature?: number;
  humidity?: number;
  /** Drizzle (WMO 51–57): different fall speed and wind factor. */
  isDrizzle?: boolean;
}
