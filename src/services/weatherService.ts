/** Orchestrator: geocode → fetch → format → WeatherData. */

import type { Units, WeatherData, WeatherQuery } from "../weather/types";
import { UNITS } from "../weather/units";
import { WeatherError } from "./errors";
import { geocodeCity, reverseGeocode } from "./geocoder";
import { CURRENT_FIELDS, DAILY_FIELDS, getForecast, HOURLY_FIELDS } from "./weatherApi";
import { mapCurrent, mapForecast } from "./openMeteoMapper";

/** Forecast tiles after today. */
const FORECAST_DAYS = 6;

interface Place {
  lat: number;
  lon: number;
  name?: string;
  countryCode?: string;
}

/**
 * Resolved places per query: a name's coordinates and a point's name don't
 * change, so the silent refresh and a units switch go straight to the forecast.
 * Only named places are kept — a failed reverse lookup is retried next time.
 */
const places = new Map<string, Place>();

const placeKey = ({ q, lat, lon }: WeatherQuery): string =>
  q && (lat == null || lon == null) ? `q:${q.trim().toLowerCase()}` : `${lat},${lon}`;

async function resolvePlace(query: WeatherQuery): Promise<Place> {
  const key = placeKey(query);
  const cached = places.get(key);
  if (cached) return cached;

  let place: Place;
  if (query.q && (query.lat == null || query.lon == null)) {
    const found = await geocodeCity(query.q);
    if (!found) {
      throw new WeatherError(`Could not find coordinates for city: ${query.q}`, "GEOCODE_FAILED");
    }
    place = { lat: found.latitude, lon: found.longitude, name: found.name, countryCode: found.country_code };
  } else if (query.lat != null && query.lon != null) {
    place = { lat: query.lat, lon: query.lon };
    try {
      const reverse = await reverseGeocode(query.lat, query.lon);
      if (reverse) place = { ...place, name: reverse.name, countryCode: reverse.countryCode };
    } catch {
      // Optional: mapCurrent falls back to the timezone's city name.
    }
  } else {
    throw new WeatherError("Latitude and longitude are required", "GEOCODE_FAILED");
  }

  if (place.name) places.set(key, place);
  return place;
}

export const fetchWeather = async (
  searchParams: WeatherQuery & { units: Units },
): Promise<WeatherData> => {
  const { lat, lon, name, countryCode } = await resolvePlace(searchParams);

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

  return { ...mapCurrent(data, name, countryCode), ...mapForecast(data) };
};
