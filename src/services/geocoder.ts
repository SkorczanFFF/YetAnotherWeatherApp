/** City name ↔ coordinates via OpenMeteo Geocoding + Nominatim reverse geocoding. */

import { WeatherError } from "./errors";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  timezone: string;
}

interface ReverseGeocodeResult {
  name: string;
  countryCode: string;
}

const getPreferredLanguage = (): string => {
  if (typeof navigator === "undefined") return "en";
  const lang =
    navigator.language ||
    (navigator as { userLanguage?: string }).userLanguage;
  return (lang || "en").split("-")[0].toLowerCase();
};

/** Geocode city name to coordinates. Ranks by PPLC/PPLA then population; language fallback. */
export const geocodeCity = async (
  city: string,
): Promise<GeocodingResult | null> => {
  const trimmed = city.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const trySearch = async (
    language: string,
  ): Promise<GeocodingResult | null> => {
    const url = new URL(GEOCODING_URL);
    url.searchParams.append("name", trimmed);
    url.searchParams.append("count", "25");
    url.searchParams.append("language", language);
    url.searchParams.append("format", "json");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new WeatherError(
        `Geocoding API error: ${response.status} ${response.statusText}`,
        "GEOCODE_FAILED",
      );
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const results = data.results as (GeocodingResult & {
      population?: number;
      feature_code?: string;
    })[];
    const rank = (r: (typeof results)[0]): number => {
      const pop = r.population ?? 0;
      const code = (r.feature_code || "").toUpperCase();
      if (code === "PPLC") return 1e9 + pop;
      if (code === "PPLA") return 1e8 + pop;
      return pop;
    };
    results.sort((a, b) => rank(b) - rank(a));

    const best = results[0];
    return {
      id: best.id,
      name: best.name,
      latitude: best.latitude,
      longitude: best.longitude,
      country: best.country,
      country_code: best.country_code,
      timezone: best.timezone,
    };
  };

  const lang = getPreferredLanguage();
  let result = await trySearch(lang);
  if (!result && lang !== "en") {
    result = await trySearch("en");
  }
  return result;
};

/** Nominatim reverse geocode: (lat, lon) → place name and country. */
export const reverseGeocode = async (
  lat: number,
  lon: number,
): Promise<ReverseGeocodeResult | null> => {
  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lon.toString());
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "YetAnotherWeatherApp/1.0 (weather app; reverse geocode for display name)",
      },
    });

    if (!response.ok) {
      throw new WeatherError(
        `Reverse geocode error: ${response.status} ${response.statusText}`,
        "GEOCODE_FAILED",
      );
    }
    const data = (await response.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        country?: string;
        country_code?: string;
      };
    };
    const addr = data?.address;
    if (!addr) return null;

    const name =
      addr.city ??
      addr.town ??
      addr.village ??
      addr.municipality ??
      addr.state ??
      addr.country ??
      null;
    const countryCode = (addr.country_code ?? "").toUpperCase();
    if (!name) return null;

    return { name, countryCode };
  } catch (error) {
    if (error instanceof WeatherError) throw error;
    throw new WeatherError(
      `Reverse geocode failed: ${error instanceof Error ? error.message : String(error)}`,
      "NETWORK_ERROR",
    );
  }
};
