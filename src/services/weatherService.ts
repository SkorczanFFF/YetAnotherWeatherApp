/** Orchestrator: geocode → fetch → format → WeatherData. */

import type { Units, WeatherData, WeatherQuery } from "../weather/types";
import { UNITS } from "../weather/units";
import { WeatherError } from "./errors";
import { geocodeCity, reverseGeocode } from "./geocoder";
import { CURRENT_FIELDS, DAILY_FIELDS, getForecast, HOURLY_FIELDS } from "./weatherApi";
import { formatCurrentWeather, formatWeeklyWeather } from "./weatherFormatter";

/** Forecast tiles after today. */
const FORECAST_DAYS = 6;

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

  const { temperatureApi, windApi } = UNITS[searchParams.units];
  const data = await getForecast({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    temperature_unit: temperatureApi,
    wind_speed_unit: windApi,
    current: CURRENT_FIELDS.join(","),
    hourly: HOURLY_FIELDS.join(","),
    daily: DAILY_FIELDS.join(","),
    // From the current hour: 12 upcoming points + slack until the next refresh.
    forecast_hours: 14,
    forecast_days: FORECAST_DAYS + 1,
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
