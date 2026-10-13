import { useEffect, useState } from "react";
import { WeatherError } from "../services/errors";
import { fetchWeather } from "../services/weatherService";
import type { Units, WeatherData, WeatherQuery } from "../weather/types";

/** Loaders stay up at least this long, so a fast fetch doesn't flash them. */
const MIN_LOADING_MS = 500;
/** Current conditions and the hourly chart's "now" go stale without a refetch. */
const REFRESH_MS = 15 * 60_000;

const errorMessage = (err: unknown): string => {
  const code = err instanceof WeatherError ? err.code : null;
  if (code === "GEOCODE_FAILED") return "City not found. Please check the name and try again.";
  if (code === "API_ERROR") return "Weather service is temporarily unavailable.";
  return "Network error. Please check your connection.";
};

interface WeatherState {
  weather: WeatherData | null;
  /**
   * Units the shown data was fetched in — the toggle flips `units` before the
   * new data arrives, and Open-Meteo returns °F/mph in imperial mode.
   */
  weatherUnits: Units;
  loading: boolean;
  error: string | null;
}

/** Fetches on every query/units change (a superseded request's result is dropped) and refreshes silently. */
export function useWeather(query: WeatherQuery, units: Units): WeatherState {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherUnits, setWeatherUnits] = useState<Units>(units);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A superseded request's late result and loading-finished must not touch the state.
    let cancelled = false;
    const show = (data: WeatherData) => {
      setWeather(data);
      setWeatherUnits(units);
      setError(null);
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      const startedAt = Date.now();
      try {
        const data = await fetchWeather({ ...query, units });
        if (!cancelled) show(data);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(errorMessage(err));
      } finally {
        const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
        if (remaining > 0) {
          setTimeout(() => {
            if (!cancelled) setLoading(false);
          }, remaining);
        } else if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    // Silent refresh: no loader, and a failure keeps the shown data.
    const refresh = window.setInterval(async () => {
      try {
        const data = await fetchWeather({ ...query, units });
        if (!cancelled) show(data);
      } catch (err) {
        console.warn(err);
      }
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [query, units]);

  return { weather, weatherUnits, loading, error };
}
