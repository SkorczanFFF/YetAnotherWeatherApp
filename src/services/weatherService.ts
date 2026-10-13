/** Orchestrator: geocode → fetch → format → WeatherData. */

import type { Units, WeatherData, WeatherQuery } from "../weather/types";
import { WeatherError } from "./errors";
import { geocodeCity, reverseGeocode } from "./geocoder";
import { getForecast, PRESSURE_LEVELS } from "./weatherApi";
import { formatCurrentWeather, formatWeeklyWeather } from "./weatherFormatter";

/** Upper-air, stability and radiation fields for the scene's cloud physics. */
const ATMOSPHERE_FIELDS = [
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
  ...PRESSURE_LEVELS.flatMap((p) => [`cloud_cover_${p}hPa`, `geopotential_height_${p}hPa`]),
].join(",");

const getFormattedWeatherData = async (
  searchParams: WeatherQuery & { units: Units },
): Promise<WeatherData> => {
  let lat = searchParams.lat;
  let lon = searchParams.lon;
  let locationName: string | undefined;
  let countryCode: string | undefined;

  if (searchParams.q && (lat == null || lon == null)) {
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

  if (lat == null || lon == null) {
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
      // Optional: the formatter falls back to the timezone name.
    }
  }

  let temperature_unit = "celsius";
  let wind_speed_unit = "kmh";
  if (searchParams.units === "imperial") {
    temperature_unit = "fahrenheit";
    wind_speed_unit = "mph";
  }

  const data = await getForecast({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    temperature_unit,
    wind_speed_unit,
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,weather_code,wind_speed_10m,wind_direction_10m,is_day,cloud_cover,visibility,uv_index,dew_point_2m,precipitation,rain,showers,snowfall,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_gusts_10m," +
      ATMOSPHERE_FIELDS,
    hourly: "temperature_2m",
    daily:
      "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max",
    // From the current hour: 12 upcoming points + slack until the next refresh.
    forecast_hours: 14,
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
