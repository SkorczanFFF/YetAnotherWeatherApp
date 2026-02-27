/**
 * Weather domain types — shared by config, codes, and simulation.
 * Re-exports app weather types; defines EffectType, Intensity, TimeOfDay, SimulationConfig.
 */

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
  windSpeed: number;
  windDirection: number;
  timeOfDay: TimeOfDay;
  parallaxAmount: number;
  sunrise: number;
  sunset: number;
  useRealtimeClock: boolean;
  /** Temperature (°C) for snow/rain blend (e.g. freezing rain). */
  temperature?: number;
  /** Humidity 0–100 for fog/mist scaling. */
  humidity?: number;
}
