/** All weather types: API data, effect classification, time phases, simulation config. */

export interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}

export type Units = "metric" | "imperial";

export interface DailyWeather {
  title: string;
  temp: number;
  temp_min: number;
  icon: string;
}

export interface WeatherData {
  dt: number;
  timezone: string;
  name: string;
  country: string;
  lat?: number;
  lon?: number;
  temp: number;
  temp_max: number;
  temp_min: number;
  pressure: number;
  feels_like: number;
  sunrise: number;
  sunset: number;
  humidity: number;
  speed: number;
  details: string;
  icon: string;
  daily: DailyWeather[];
  weather_code: number;
  is_day: number;
  wind_direction?: number;
}

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
  /** Debug override: cloud opacity multiplier (0–1). undefined = auto from cloud cover. */
  cloudOpacity?: number;
  /** Debug override: cloud color (0 = white, 1 = dark gray). undefined = auto from weather. */
  cloudColorOverride?: number;
  /** Height fog falloff rate. Higher = fog hugs ground more. Default 0.25. */
  fogHeightFalloff?: number;
}
