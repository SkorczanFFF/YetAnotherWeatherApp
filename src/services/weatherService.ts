/** Orchestrator: geocode → fetch → format → WeatherData. */

import type { WeatherData } from "../weather/types";
import { WeatherError } from "./errors";
import { geocodeCity, reverseGeocode } from "./geocoder";
import { getWeatherData } from "./weatherApi";
import { formatCurrentWeather, formatWeeklyWeather } from "./weatherFormatter";

interface WeatherParams {
  q?: string;
  lat?: number;
  lon?: number;
  units?: string;
  timezone?: string;
}

const getFormattedWeatherData = async (
  searchParams: WeatherParams,
): Promise<WeatherData> => {
  let lat = searchParams.lat;
  let lon = searchParams.lon;
  let locationName: string | undefined;
  let countryCode: string | undefined;

  if (searchParams.q && (!lat || !lon)) {
    const geocodingResult = await geocodeCity(searchParams.q);
    if (!geocodingResult) {
      throw new WeatherError(
        `Could not find coordinates for city: ${searchParams.q}`,
        "GEOCODE_FAILED",
      );
    }
    lat = geocodingResult.latitude;
    lon = geocodingResult.longitude;
    locationName = geocodingResult.name;
    countryCode = geocodingResult.country_code;
  }

  if (!lat || !lon) {
    throw new WeatherError("Latitude and longitude are required", "GEOCODE_FAILED");
  }

  if (!locationName) {
    try {
      const reverse = await reverseGeocode(lat, lon);
      if (reverse) {
        locationName = reverse.name;
        countryCode = reverse.countryCode;
      }
    } catch {
      // Reverse geocode is optional — fall back to coordinates
    }
  }

  let temperature_unit = "celsius";
  let wind_speed_unit = "kmh";
  if (searchParams.units === "imperial") {
    temperature_unit = "fahrenheit";
    wind_speed_unit = "mph";
  }

  const data = await getWeatherData("forecast", {
    latitude: lat,
    longitude: lon,
    timezone: searchParams.timezone || "auto",
    temperature_unit,
    wind_speed_unit,
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,weather_code,wind_speed_10m,wind_direction_10m,is_day,cloud_cover,visibility,uv_index,dew_point_2m,precipitation",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily:
      "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max",
    forecast_hours: 25,
    forecast_days: 8,
  });

  const formattedCurrentWeather = formatCurrentWeather(
    data,
    locationName,
    countryCode,
  );
  const formattedWeeklyWeather = formatWeeklyWeather(data);

  return { ...formattedCurrentWeather, ...formattedWeeklyWeather };
};

export default getFormattedWeatherData;
