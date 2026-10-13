/** Weather data formatting: API response → WeatherData, descriptions, date formatting. */

import { DateTime } from "luxon";
import type {
  AtmosphereData,
  AtmosphereLevel,
  HourlyForecast,
  Units,
  WeatherData,
} from "../weather/types";
import { type OpenMeteoResponse, PRESSURE_LEVELS } from "./weatherApi";

const weatherDescriptions: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const describeCode = (code: number) => weatherDescriptions[code] ?? "Unknown";

/**
 * The current (15-min) weather_code is the step of the hour ending at the next
 * full hour, while cloud_cover is interpolated between the hours: at 11:15 a
 * deck breaking from 74 % to 41 % read "Mainly clear" next to 66 %. A pure
 * cloud code (0–3) is re-derived from the shown cover with Open-Meteo's own
 * thresholds, so the label, the cloud cover figure and the scene agree; fog,
 * precipitation and storms keep the model's code.
 */
const cloudCode = (code: number, cover: number | undefined) =>
  code > 3 || typeof cover !== "number" ? code : cover < 20 ? 0 : cover < 50 ? 1 : cover < 80 ? 2 : 3;

/** `timezone=auto` returns location-local ISO strings without an offset. */
const localSeconds = (iso: string, zone: string) => DateTime.fromISO(iso, { zone }).toSeconds();

export const formatCurrentWeather = (
  data: OpenMeteoResponse,
  locationName?: string,
  countryCode?: string,
): Omit<WeatherData, "daily" | "hourly" | "timezone"> => {
  const { latitude: lat, longitude: lon, timezone, current, daily } = data;
  const {
    temperature_2m: temp,
    apparent_temperature: feels_like,
    relative_humidity_2m: humidity,
    pressure_msl: pressure,
    weather_code: modelCode,
    wind_speed_10m: speed,
    wind_direction_10m: wind_direction,
    is_day,
    cloud_cover,
    visibility,
    uv_index,
    dew_point_2m,
    precipitation,
    cloud_cover_low,
    cloud_cover_mid,
    cloud_cover_high,
    wind_gusts_10m,
    rain,
    showers,
    snowfall,
  } = current;
  const { temperature_2m_max, temperature_2m_min, sunrise, sunset } = daily;
  const weather_code = cloudCode(modelCode, cloud_cover);
  const details = describeCode(weather_code);
  const sunrise_time = localSeconds(sunrise[0], timezone);
  const sunset_time = localSeconds(sunset[0], timezone);
  const next_sunrise = sunrise[1] ? localSeconds(sunrise[1], timezone) : undefined;
  const temp_max = temperature_2m_max[0];
  const temp_min = temperature_2m_min[0];
  const name =
    locationName || timezone.split("/").pop()?.replace(/_/g, " ") || "Unknown";
  const country = countryCode || timezone.split("/")[0] || "";

  return {
    lat,
    lon,
    temp,
    feels_like,
    temp_min,
    temp_max,
    pressure,
    humidity,
    name,
    country,
    sunrise: sunrise_time,
    sunset: sunset_time,
    next_sunrise,
    details,
    speed,
    weather_code,
    is_day,
    wind_direction,
    cloud_cover,
    visibility,
    uv_index,
    dew_point: dew_point_2m,
    precipitation,
    cloud_cover_low,
    cloud_cover_mid,
    cloud_cover_high,
    wind_gusts: wind_gusts_10m,
    rain,
    showers,
    snowfall,
    atmosphere: formatAtmosphere(data),
  };
};

const wind = (speed?: number, direction?: number) =>
  speed != null && direction != null ? { speed, direction } : undefined;

/** Upper-air column for the scene's cloud physics; every field optional (model gaps). */
const formatAtmosphere = (data: OpenMeteoResponse): AtmosphereData => {
  const c = data.current;
  const levels: AtmosphereLevel[] = [];
  for (const pressure of PRESSURE_LEVELS) {
    const heightM = c[`geopotential_height_${pressure}hPa`];
    const cover = c[`cloud_cover_${pressure}hPa`];
    if (heightM != null && cover != null) levels.push({ heightM, cover });
  }
  return {
    elevationM: data.elevation,
    boundaryLayerM: c.boundary_layer_height,
    cape: c.cape,
    liftedIndex: c.lifted_index,
    freezingLevelM: c.freezing_level_height,
    shortwave: c.shortwave_radiation,
    direct: c.direct_radiation,
    topOfAtmosphere: c.terrestrial_radiation,
    wind850: wind(c.wind_speed_850hPa, c.wind_direction_850hPa),
    wind300: wind(c.wind_speed_300hPa, c.wind_direction_300hPa),
    levels,
  };
};

export const formatWeeklyWeather = (
  data: OpenMeteoResponse,
): Pick<WeatherData, "timezone" | "daily" | "hourly"> => {
  const { timezone, daily, hourly } = data;
  const weeklyData = daily.time.slice(1, 8).map((date, index) => {
    const i = index + 1;
    const code = daily.weather_code[i];
    const dtSec = localSeconds(date, timezone);
    return {
      title: formatToLocalTime(dtSec, timezone, "ccc"),
      date: formatToLocalTime(dtSec, timezone, "dd LLL"),
      temp: daily.temperature_2m_max[i],
      temp_min: daily.temperature_2m_min[i],
      code,
      details: describeCode(code),
      precip_prob: daily.precipitation_probability_max?.[i] ?? 0,
      wind_max: daily.wind_speed_10m_max?.[i] ?? 0,
      wind_dir: daily.wind_direction_10m_dominant?.[i],
      uv_max: daily.uv_index_max?.[i] ?? 0,
    };
  });

  const hourlyData: HourlyForecast[] = (hourly?.time || []).map((iso, i) => ({
    time: localSeconds(iso, timezone),
    temp: hourly.temperature_2m[i],
  }));

  return { timezone, daily: weeklyData, hourly: hourlyData };
};

export const formatToLocalTime = (secs: number, zone: string, format: string): string =>
  DateTime.fromSeconds(secs).setZone(zone).toFormat(format);

export const tempSymbol = (units: Units): string => (units === "metric" ? "°C" : "°F");

/** Rounded degrees without a unit; `|| 0` turns −0 into 0. */
export const formatDegrees = (value: number): string => `${Math.round(value) || 0}°`;

export const formatTemperature = (value: number, units: Units): string =>
  `${Math.round(value) || 0}${tempSymbol(units)}`;

export const formatSpeed = (value: number, units: Units): string =>
  `${value.toFixed()} ${units === "metric" ? "km/h" : "mph"}`;

const CARDINALS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

/** Degree bearing → 16-point compass label. `undefined`/`NaN` yields `""`. */
export const toCardinal = (deg?: number): string => {
  if (deg == null || Number.isNaN(deg)) return "";
  const idx = Math.round((deg % 360) / 22.5) % 16;
  return CARDINALS[idx];
};
