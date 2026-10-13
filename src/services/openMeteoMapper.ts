/** API response → WeatherData. Display formatting lives in utils/format.ts. */

import { DateTime } from "luxon";
import type {
  AtmosphereData,
  AtmosphereLevel,
  HourlyForecast,
  WeatherData,
} from "../weather/types";
import { codeForCover, codeInfo } from "../weather/codes";
import { formatToLocalTime } from "../utils/format";
import { type OpenMeteoResponse, PRESSURE_LEVELS } from "./weatherApi";

/** `timezone=auto` returns location-local ISO strings without an offset. */
const localSeconds = (iso: string, zone: string) => DateTime.fromISO(iso, { zone }).toSeconds();

export const mapCurrent = (
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
  const weather_code = codeForCover(modelCode, cloud_cover);
  const details = codeInfo(weather_code).label;
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
    atmosphere: mapAtmosphere(data),
  };
};

const wind = (speed?: number, direction?: number) =>
  speed != null && direction != null ? { speed, direction } : undefined;

/** Upper-air column for the scene's cloud physics; every field optional (model gaps). */
const mapAtmosphere = (data: OpenMeteoResponse): AtmosphereData => {
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

export const mapForecast = (
  data: OpenMeteoResponse,
): Pick<WeatherData, "timezone" | "daily" | "hourly"> => {
  const { timezone, daily, hourly } = data;
  // Day 0 is today (shown by the hero); the rest is the forecast.
  const weeklyData = daily.time.slice(1).map((date, index) => {
    const i = index + 1;
    const code = daily.weather_code[i];
    const dtSec = localSeconds(date, timezone);
    return {
      title: formatToLocalTime(dtSec, timezone, "ccc"),
      date: formatToLocalTime(dtSec, timezone, "dd LLL"),
      temp: daily.temperature_2m_max[i],
      temp_min: daily.temperature_2m_min[i],
      code,
      details: codeInfo(code).label,
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
