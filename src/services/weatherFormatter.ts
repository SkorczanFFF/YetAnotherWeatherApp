/** Weather data formatting: API response → WeatherData, icon URLs, date formatting. */

import { DateTime } from "luxon";
import type { WeatherData } from "../weather/types";
import type { OpenMeteoResponse } from "./weatherApi";

const weatherCodeMap: Record<number, { description: string; icon: string }> = {
  0: { description: "Clear sky", icon: "01d" },
  1: { description: "Mainly clear", icon: "02d" },
  2: { description: "Partly cloudy", icon: "03d" },
  3: { description: "Overcast", icon: "04d" },
  45: { description: "Fog", icon: "50d" },
  48: { description: "Depositing rime fog", icon: "50d" },
  51: { description: "Light drizzle", icon: "09d" },
  53: { description: "Moderate drizzle", icon: "09d" },
  55: { description: "Dense drizzle", icon: "09d" },
  56: { description: "Light freezing drizzle", icon: "09d" },
  57: { description: "Dense freezing drizzle", icon: "09d" },
  61: { description: "Slight rain", icon: "10d" },
  63: { description: "Moderate rain", icon: "10d" },
  65: { description: "Heavy rain", icon: "10d" },
  66: { description: "Light freezing rain", icon: "13d" },
  67: { description: "Heavy freezing rain", icon: "13d" },
  71: { description: "Slight snow fall", icon: "13d" },
  73: { description: "Moderate snow fall", icon: "13d" },
  75: { description: "Heavy snow fall", icon: "13d" },
  77: { description: "Snow grains", icon: "13d" },
  80: { description: "Slight rain showers", icon: "09d" },
  81: { description: "Moderate rain showers", icon: "09d" },
  82: { description: "Violent rain showers", icon: "09d" },
  85: { description: "Slight snow showers", icon: "13d" },
  86: { description: "Heavy snow showers", icon: "13d" },
  95: { description: "Thunderstorm", icon: "11d" },
  96: { description: "Thunderstorm with slight hail", icon: "11d" },
  99: { description: "Thunderstorm with heavy hail", icon: "11d" },
};

const getIconCode = (weatherCode: number, is_day: number): string => {
  const weather = weatherCodeMap[weatherCode] || {
    description: "Unknown",
    icon: "01d",
  };
  if (is_day === 0) return weather.icon.replace("d", "n");
  return weather.icon;
};

export const formatCurrentWeather = (
  data: OpenMeteoResponse,
  locationName?: string,
  countryCode?: string,
): Omit<WeatherData, "daily" | "timezone"> => {
  const { latitude: lat, longitude: lon, timezone, current, daily } = data;
  const {
    temperature_2m: temp,
    apparent_temperature: feels_like,
    relative_humidity_2m: humidity,
    pressure_msl: pressure,
    weather_code,
    wind_speed_10m: speed,
    wind_direction_10m: wind_direction,
    time: dt_str,
    is_day,
  } = current;
  const { temperature_2m_max, temperature_2m_min, sunrise, sunset } = daily;
  const { description: details } =
    weatherCodeMap[weather_code] || { description: "Unknown" };
  const icon = getIconCode(weather_code, is_day);
  const dt = DateTime.fromISO(dt_str).toSeconds();
  const sunrise_time = DateTime.fromISO(sunrise[0]).toSeconds();
  const sunset_time = DateTime.fromISO(sunset[0]).toSeconds();
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
    dt,
    country,
    sunrise: sunrise_time,
    sunset: sunset_time,
    details,
    icon,
    speed,
    weather_code,
    is_day,
    wind_direction,
  };
};

export const formatWeeklyWeather = (
  data: OpenMeteoResponse,
): Pick<WeatherData, "timezone" | "daily"> => {
  const { timezone, daily } = data;
  const weeklyData = daily.time.slice(1, 8).map((date, index) => {
    const i = index + 1;
    return {
      title: formatToLocalTime(
        DateTime.fromISO(date).toSeconds(),
        timezone,
        "cccc",
      ),
      temp: daily.temperature_2m_max[i],
      temp_min: daily.temperature_2m_min[i],
      icon: weatherCodeMap[daily.weather_code[i]]?.icon || "01d",
    };
  });

  return { timezone, daily: weeklyData };
};

export const formatToLocalTime = (
  secs: number,
  zone: string,
  format: string = "cccc, dd LLLL yyyy', 'HH:mm",
): string => DateTime.fromSeconds(secs).setZone(zone).toFormat(format);

export const iconUrlFromCode = (code: string): string =>
  `https://openweathermap.org/img/wn/${code}@4x.png`;

export const formatTemperature = (value: number, units: string): string =>
  `${value.toFixed()}°${units === "metric" ? "C" : "F"}`;

export const formatSpeed = (value: number, units: string): string =>
  `${value.toFixed()} ${units === "metric" ? "km/h" : "mph"}`;
