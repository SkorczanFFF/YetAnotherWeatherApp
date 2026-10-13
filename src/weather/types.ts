/** Weather domain types: API data and WMO effect classification. Scene parameters live in sceneParams.ts. */

export interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}

export type Units = "metric" | "imperial";

/** What started the current weather fetch — picks the loader and its label. */
export type LoadSource = "initial" | "search" | "location" | "map" | "units";

export interface DailyWeather {
  /** Short weekday, e.g. "Mon". */
  title: string;
  date: string;
  temp: number;
  temp_min: number;
  /** WMO weather code (most severe of the day). */
  code: number;
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
}

export interface WeatherData {
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
  humidity: number;
  speed: number;
  details: string;
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
  /** Cloud cover per altitude band, %, 0–100. */
  cloud_cover_low?: number;
  cloud_cover_mid?: number;
  cloud_cover_high?: number;
  /** Wind gusts in the same speed unit as `speed`. */
  wind_gusts?: number;
  /** Liquid precipitation split, mm (preceding hour). */
  rain?: number;
  showers?: number;
  /** Snowfall, cm (preceding hour). */
  snowfall?: number;
  /** Vertical structure of the atmosphere — drives the cloud physics in the scene. */
  atmosphere?: AtmosphereData;
}

/** One pressure level of the model column. */
export interface AtmosphereLevel {
  /** Geopotential height above sea level, m. */
  heightM: number;
  /** Cloud cover at this level, %, 0–100. */
  cover: number;
}

/** Raw upper-air / radiation readings from Open-Meteo (model values, not observations). */
export interface AtmosphereData {
  /** Grid-cell elevation above sea level, m. */
  elevationM?: number;
  /** Boundary layer height above ground, m. */
  boundaryLayerM?: number;
  /** Convective available potential energy, J/kg. */
  cape?: number;
  /** Lifted index (negative = unstable). */
  liftedIndex?: number;
  /** 0 °C level above sea level, m. */
  freezingLevelM?: number;
  /** Global and direct shortwave on a horizontal surface, and top-of-atmosphere, W/m². */
  shortwave?: number;
  direct?: number;
  topOfAtmosphere?: number;
  /** Winds aloft in the same speed unit as `speed`; direction = from, degrees. */
  wind850?: { speed: number; direction: number };
  wind300?: { speed: number; direction: number };
  levels: AtmosphereLevel[];
}

export type EffectType =
  | "clear"
  | "rain"
  | "snow"
  | "fog"
  | "thunderstorm";

export type Intensity = "light" | "moderate" | "heavy";
