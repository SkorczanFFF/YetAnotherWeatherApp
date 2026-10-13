/** Raw OpenMeteo forecast API call + response types. */

import { WeatherError } from "./errors";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoCurrentData {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  pressure_msl: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  is_day: number;
  cloud_cover: number;
  cloud_cover_low?: number;
  cloud_cover_mid?: number;
  cloud_cover_high?: number;
  wind_gusts_10m?: number;
  rain?: number;
  showers?: number;
  snowfall?: number;
  visibility: number;
  uv_index: number;
  dew_point_2m: number;
  precipitation: number;
  boundary_layer_height?: number;
  cape?: number;
  lifted_index?: number;
  freezing_level_height?: number;
  shortwave_radiation?: number;
  direct_radiation?: number;
  terrestrial_radiation?: number;
  wind_speed_850hPa?: number;
  wind_direction_850hPa?: number;
  wind_speed_300hPa?: number;
  wind_direction_300hPa?: number;
  /** cloud_cover_{p}hPa / geopotential_height_{p}hPa for every p in PRESSURE_LEVELS. */
  [pressureLevelField: `${"cloud_cover" | "geopotential_height"}_${number}hPa`]: number | undefined;
}

/** Pressure levels requested for the cloud column, hPa (surface → upper troposphere). */
export const PRESSURE_LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300, 250] as const;

/** Requested `current` fields; `satisfies` keeps them inside OpenMeteoCurrentData. */
export const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "pressure_msl",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "is_day",
  "cloud_cover",
  "visibility",
  "uv_index",
  "dew_point_2m",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "wind_gusts_10m",
  // Upper-air, stability and radiation fields for the scene's cloud physics.
  "boundary_layer_height",
  "cape",
  "lifted_index",
  "freezing_level_height",
  "shortwave_radiation",
  "direct_radiation",
  "terrestrial_radiation",
  "wind_speed_850hPa",
  "wind_direction_850hPa",
  "wind_speed_300hPa",
  "wind_direction_300hPa",
  ...PRESSURE_LEVELS.flatMap((p) => [`cloud_cover_${p}hPa`, `geopotential_height_${p}hPa`] as const),
] satisfies (keyof OpenMeteoCurrentData)[];

interface OpenMeteoHourlyData {
  time: string[];
  temperature_2m: number[];
}

interface OpenMeteoDailyData {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
  sunrise: string[];
  sunset: string[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
  uv_index_max: number[];
}

export const HOURLY_FIELDS = ["temperature_2m"] satisfies (keyof OpenMeteoHourlyData)[];

export const DAILY_FIELDS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "weather_code",
  "sunrise",
  "sunset",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_direction_10m_dominant",
  "uv_index_max",
] satisfies (keyof OpenMeteoDailyData)[];

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  current: OpenMeteoCurrentData;
  hourly: OpenMeteoHourlyData;
  daily: OpenMeteoDailyData;
}

interface OpenMeteoQueryParams {
  latitude: number;
  longitude: number;
  timezone: string;
  temperature_unit: string;
  wind_speed_unit: string;
  current: string;
  hourly: string;
  daily: string;
  forecast_hours?: number;
  forecast_days?: number;
}

export const getForecast = async (
  searchParams: OpenMeteoQueryParams,
): Promise<OpenMeteoResponse> => {
  const url = new URL(FORECAST_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString());
  // Open-Meteo reports bad requests as HTTP 400 with { error: true, reason }.
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.error) {
    const reason = data?.reason ?? `${response.status} ${response.statusText}`;
    throw new WeatherError(`API error: ${reason}`, "API_ERROR");
  }

  return data;
};
