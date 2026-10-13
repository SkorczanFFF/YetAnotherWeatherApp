import React, { useState, useEffect, useMemo, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import { ToastContainer } from "react-toastify";
import Navbar from "./components/navbar/Navbar";
import CurrentWeather from "./components/weather/current/CurrentWeather";
import HourlyChart from "./components/weather/hourly/HourlyChart";
import WeeklyForecast from "./components/weather/weekly/WeeklyForecast";
import WeatherScene from "./components/weather-scene/WeatherSceneContainer";
import DebugMenu, { type DebugTools } from "./components/debug-menu/DebugMenu";
import { MapPicker } from "./components/map-picker/MapPicker";
import { LoaderPanel, LoaderPill } from "./components/loader/Loader";
import { useGlassSpotlight } from "./styles/useGlassSpotlight";
import {
  isOverridesDirty,
  mapToSceneParams,
  type SceneOverrides,
} from "./weather/sceneParams";
import getFormattedWeatherData from "./services/weatherService";
import { tempSymbol } from "./services/weatherFormatter";
import { WeatherError } from "./services/errors";
import {
  type LoadSource,
  type WeatherQuery,
  type Units,
  type WeatherData,
} from "./weather/types";

const MIN_LOADING_MS = 500;
/** Current conditions and the hourly chart's "now" go stale without a refetch. */
const REFRESH_MS = 15 * 60_000;
/** Phones have no F7: this many quick taps on the footer status toggle the debug menu. */
const DEBUG_TAPS = 5;
const DEBUG_TAP_GAP_MS = 600;

const describeQuery = (query: WeatherQuery): string =>
  query.q
    ? query.q.charAt(0).toUpperCase() + query.q.slice(1)
    : `${query.lat?.toFixed(2)}, ${query.lon?.toFixed(2)}`;

const loadingLabel = (source: LoadSource, query: WeatherQuery, units: Units): string => {
  switch (source) {
    case "units":
      return `Switching to ${tempSymbol(units)}`;
    case "location":
      return "Loading your location";
    default:
      return `Loading ${describeQuery(query)}`;
  }
};

const formatGmtOffset = (timezone?: string): string => {
  if (!timezone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value;
    return offset ?? "";
  } catch {
    return "";
  }
};

const App = (): React.ReactElement => {
  useGlassSpotlight();
  const [query, setQuery] = useState<WeatherQuery>({ q: "katowice" });
  const [units, setUnits] = useState<Units>("metric");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  // Units the shown data was fetched in — the toggle flips `units` before the
  // new data arrives, and Open-Meteo returns °F/mph in imperial mode.
  const [weatherUnits, setWeatherUnits] = useState<Units>(units);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadSource, setLoadSource] = useState<LoadSource>("initial");
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugOverrides, setDebugOverrides] = useState<SceneOverrides | null>(null);
  const [debugTools, setDebugTools] = useState<DebugTools>({
    showPerf: true,
  });
  const [lightningNonce, setLightningNonce] = useState(0);
  const [mapPanelOpen, setMapPanelOpen] = useState(false);
  const isDebugMode = isOverridesDirty(debugOverrides);
  const currentParams = useMemo(
    () => mapToSceneParams(weather, weatherUnits, null),
    [weather, weatherUnits],
  );
  const effectiveParams = useMemo(
    () => mapToSceneParams(weather, weatherUnits, debugOverrides),
    [weather, weatherUnits, debugOverrides],
  );

  const statusTaps = useRef({ count: 0, last: 0 });
  const handleStatusTap = () => {
    const taps = statusTaps.current;
    const now = performance.now();
    taps.count = now - taps.last < DEBUG_TAP_GAP_MS ? taps.count + 1 : 1;
    taps.last = now;
    if (taps.count >= DEBUG_TAPS) {
      taps.count = 0;
      setDebugOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F7") {
        e.preventDefault();
        setDebugOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // A newer request supersedes this one: its late result and its
    // loading-finished must not touch the state.
    let cancelled = false;
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      const startedAt = Date.now();
      try {
        const data = await getFormattedWeatherData({ ...query, units });
        if (cancelled) return;
        setWeather(data);
        setWeatherUnits(units);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error(err);
        const code = err instanceof WeatherError ? err.code : null;
        const message =
          code === "GEOCODE_FAILED"
            ? "City not found. Please check the name and try again."
            : code === "API_ERROR"
              ? "Weather service is temporarily unavailable."
              : "Network error. Please check your connection.";
        setError(message);
      } finally {
        if (!cancelled) {
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
          if (remaining > 0) {
            setTimeout(() => {
              if (!cancelled) setLoading(false);
            }, remaining);
          } else {
            setLoading(false);
          }
        }
      }
    };
    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [query, units]);

  // Silent refresh: no loader, and a failure keeps the shown data.
  useEffect(() => {
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const data = await getFormattedWeatherData({ ...query, units });
        if (cancelled) return;
        setWeather(data);
        setWeatherUnits(units);
        setError(null);
      } catch (err) {
        console.warn(err);
      }
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [query, units]);

  const gmtOffset = formatGmtOffset(weather?.timezone);
  const requestQuery = (next: WeatherQuery, source: LoadSource): void => {
    setLoadSource(source);
    setQuery(next);
  };
  const changeUnits = (next: Units): void => {
    if (next === units) return;
    setLoadSource("units");
    setUnits(next);
  };
  // First load has nothing to show yet; later loads keep the data on screen.
  const initialLoading = loading && !weather;
  const refreshing = loading && !!weather;
  const label = loadingLabel(loadSource, query, units);

  return (
    <div className="App">
      <WeatherScene
        params={effectiveParams}
        showPerf={debugOpen && debugTools.showPerf}
        lightningNonce={lightningNonce}
      />
      <div className="shell">
        <Navbar
          setQuery={requestQuery}
          isDebugMode={isDebugMode}
          onOpenMapPicker={() => setMapPanelOpen(true)}
          units={units}
          setUnits={changeUnits}
          pending={loading ? loadSource : null}
        />
        <main className="main">
          <div className={`stack${refreshing ? " is-refreshing" : ""}`} aria-busy={loading}>
            {initialLoading && (
              <LoaderPanel
                label="Fetching weather"
                detail={describeQuery(query)}
              />
            )}
            {error && <p className="error">{error}</p>}
            {weather && (
              <>
                <CurrentWeather weather={weather} units={weatherUnits} />
                <HourlyChart
                  hourly={weather.hourly}
                  timezone={weather.timezone}
                  units={weatherUnits}
                />
                <WeeklyForecast items={weather.daily} units={weatherUnits} />
                <div className="footer">
                  <div className="footer-row">
                    <div className="status" onClick={handleStatusTap}>
                      <span className="dot" aria-hidden="true" />
                      <span>Open-Meteo · Live data</span>
                    </div>
                    <div className="attrib">
                      {weather.lat != null && weather.lon != null && (
                        <span>
                          Lat {weather.lat.toFixed(2)} · Lon {weather.lon.toFixed(2)}
                        </span>
                      )}
                      {gmtOffset && <span>{gmtOffset}</span>}
                    </div>
                  </div>
                  <a
                    className="git-link"
                    href="https://github.com/SkorczanFFF/YetAnotherWeatherApp"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View source on GitHub"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.97-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.99 0 1.98.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.81-.01 3.19 0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
                    </svg>
                    <span>SkorczanFFF</span>
                  </a>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <div className="refresh-indicator">
        <LoaderPill label={label} visible={refreshing} />
      </div>
      <MapPicker
        open={mapPanelOpen}
        onClose={() => setMapPanelOpen(false)}
        onPickLocation={(lat, lon) => requestQuery({ lat, lon }, "map")}
        initialCenter={
          weather?.lat != null && weather?.lon != null
            ? [weather.lat, weather.lon]
            : undefined
        }
      />
      <DebugMenu
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        overrides={debugOverrides}
        onOverridesChange={setDebugOverrides}
        currentParams={currentParams}
        effectiveParams={effectiveParams}
        tools={debugTools}
        onToolsChange={setDebugTools}
        onForceLightning={() => setLightningNonce((n) => n + 1)}
      />
      <Analytics />
      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar
        newestOnTop
        closeOnClick
        theme="dark"
      />
    </div>
  );
};

export default App;
