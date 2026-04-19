/** All weather types: API data, effect classification, time phases, simulation config. */

export interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}

export type Units = "metric" | "imperial";

export interface DailyWeather {
  title: string;
  date: string;
  temp: number;
  temp_min: number;
  icon: string;
  details: string;
  precip_prob: number;
  wind_max: number;
  wind_dir?: number;
  uv_max: number;
}

export interface HourlyForecast {
  /** Unix seconds */
  time: number;
  temp: number;
  precip_prob: number;
  weather_code: number;
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
  /** Tomorrow's sunrise (Unix seconds) — used for night moon arc. */
  next_sunrise?: number;
  /** Yesterday/today's sunset before sunrise — for pre-dawn night phase. */
  prev_sunset?: number;
  humidity: number;
  speed: number;
  details: string;
  icon: string;
  daily: DailyWeather[];
  hourly: HourlyForecast[];
  weather_code: number;
  is_day: number;
  wind_direction?: number;
  /** Cloud cover %, 0–100. */
  cloud_cover?: number;
  /** Visibility in metres. */
  visibility?: number;
  /** UV index (current). */
  uv_index?: number;
  /** Dew point in the same temp unit as `temp`. */
  dew_point?: number;
  /** Current precipitation rate (mm or in). */
  precipitation?: number;
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
  windSpeed: number;
  windDirection: number;
  timeOfDay: TimeOfDay;
  parallaxAmount: number;
  sunrise: number;
  sunset: number;
  /** Current time (Unix seconds) for sun/moon position when not using real-time clock. */
  dt?: number;
  useRealtimeClock: boolean;
  /** Weather location in degrees. Drives the atmosphere's NUE frame so the sun
   * rises/sets at the viewed city rather than (0,0). */
  lat?: number;
  lon?: number;
  temperature?: number;
  humidity?: number;
  /** Drizzle (WMO 51–57): different fall speed and wind factor. */
  isDrizzle?: boolean;
  /** Height fog falloff rate. Higher = fog hugs ground more. Default 0.25. */
  fogHeightFalloff?: number;
}
