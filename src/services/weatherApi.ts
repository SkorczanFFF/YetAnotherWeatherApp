/** Raw OpenMeteo forecast API call + response types. */

import { WeatherError } from "./errors";

const BASE_URL = "https://api.open-meteo.com/v1";

export interface OpenMeteoCurrentData {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  pressure_msl: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  is_day: number;
}

export interface OpenMeteoDailyData {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  weather_code: number[];
  sunrise: string[];
  sunset: string[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current: OpenMeteoCurrentData;
  daily: OpenMeteoDailyData;
  current_units: Record<string, string>;
  daily_units: Record<string, string>;
}

export interface OpenMeteoQueryParams {
  latitude: number;
  longitude: number;
  timezone: string;
  temperature_unit: string;
  wind_speed_unit: string;
  current: string;
  daily: string;
}

export const getWeatherData = async (
  endpoint: string,
  searchParams: OpenMeteoQueryParams,
): Promise<OpenMeteoResponse> => {
  const url = new URL(BASE_URL + "/" + endpoint);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new WeatherError(`API error: ${response.status} ${response.statusText}`, "API_ERROR");
  }

  const data = await response.json();
  if (data.error) {
    throw new WeatherError(`API returned error: ${data.reason || "Unknown error"}`, "API_ERROR");
  }

  return data;
};
