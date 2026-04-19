import React, { useState, useEffect, useMemo } from "react";
import { Analytics } from "@vercel/analytics/react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "./components/navbar/Navbar";
import CurrentWeather from "./components/weather/current/CurrentWeather";
import HourlyChart from "./components/weather/hourly/HourlyChart";
import WeeklyForecast from "./components/weather/weekly/WeeklyForecast";
import WeatherScene from "./components/weather-scene/WeatherSceneContainer";
import DebugMenu, { isOverridesDirty } from "./components/debug-menu/DebugMenu";
import { MapPicker } from "./components/map-picker/MapPicker";
import { type DebugOverrides, mapToSimulationConfig } from "./weather/config";
import type { DebugBoxPosition } from "./weather-scene/scene/DebugBox";
import getFormattedWeatherData from "./services/weatherService";
import { WeatherError } from "./services/errors";
import { type SimulationConfig, type WeatherQuery, type Units, type WeatherData } from "./weather/types";

const MIN_LOADING_MS = 500;

const formatGmtOffset = (timezone?: string): string => {
  if (!timezone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value;
    return offset ? offset.replace("GMT", "GMT") : "";
  } catch {
    return "";
  }
};

const App = (): React.ReactElement => {
  const [query, setQuery] = useState<WeatherQuery>({ q: "katowice" });
  const [units, setUnits] = useState<Units>("metric");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugOverrides, setDebugOverrides] = useState<DebugOverrides | null>(null);
  const [debugBoxPosition, setDebugBoxPosition] = useState<DebugBoxPosition>({
    x: 0,
    y: 0,
    z: 0,
  });
  const [freeCamera, setFreeCamera] = useState(false);
  const [mapPanelOpen, setMapPanelOpen] = useState(false);
  const isDebugMode = isOverridesDirty(debugOverrides);
  const currentConfig = useMemo<SimulationConfig | null>(
    () => mapToSimulationConfig(weather, null),
    [weather],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F7") {
        e.preventDefault();
        setDebugOpen((prev) => !prev);
      }
      if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target?.closest("input, textarea, [contenteditable]")) return;
        if (debugOpen) {
          e.preventDefault();
          setFreeCamera((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [debugOpen]);

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      const startedAt = Date.now();
      try {
        const data = await getFormattedWeatherData({ ...query, units });
        setWeather(data);
      } catch (err: unknown) {
        const code = err instanceof WeatherError ? err.code : null;
        const message =
          code === "GEOCODE_FAILED"
            ? "City not found. Please check the name and try again."
            : code === "API_ERROR"
              ? "Weather service is temporarily unavailable."
              : "Network error. Please check your connection.";
        setError(message);
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        if (remaining > 0) {
          setTimeout(() => setLoading(false), remaining);
        } else {
          setLoading(false);
        }
      }
    };
    fetchWeather();
  }, [query, units]);

  const gmtOffset = formatGmtOffset(weather?.timezone);

  return (
    <div className="App" id="App">
      <WeatherScene
        weather={weather}
        overrides={debugOverrides}
        showDebugBox={debugOpen}
        debugBoxPosition={debugBoxPosition}
        freeCamera={freeCamera}
      />
      <div className="shell">
        <Navbar
          setQuery={setQuery}
          isDebugMode={isDebugMode}
          onOpenMapPicker={() => setMapPanelOpen(true)}
          units={units}
          setUnits={setUnits}
        />
        <main className="main">
          <div className={`stack${loading ? " is-loading" : ""}`}>
            {error && <p className="error">{error}</p>}
            {weather && (
              <>
                <CurrentWeather weather={weather} units={units} />
                {weather.hourly?.length > 1 && (
                  <HourlyChart
                    hourly={weather.hourly}
                    timezone={weather.timezone}
                    units={units}
                  />
                )}
                <WeeklyForecast items={weather.daily} units={units} />
                <div className="footer">
                  <div className="footer-row">
                    <div className="status">
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
            {loading && (
              <div className="loading" aria-live="polite" aria-busy="true">
                <div className="loader" aria-hidden="true" />
              </div>
            )}
          </div>
        </main>
      </div>
      <MapPicker
        open={mapPanelOpen}
        onClose={() => setMapPanelOpen(false)}
        onPickLocation={(lat, lon) => {
          setQuery({ lat, lon });
          setMapPanelOpen(false);
        }}
        initialCenter={
          weather?.lat != null && weather?.lon != null
            ? [weather.lat, weather.lon]
            : undefined
        }
      />
      <DebugMenu
        open={debugOpen}
        onClose={() => {
          setDebugOpen(false);
          setFreeCamera(false);
        }}
        overrides={debugOverrides}
        onOverridesChange={setDebugOverrides}
        currentConfig={currentConfig}
        debugBoxPosition={debugBoxPosition}
        onDebugBoxPositionChange={setDebugBoxPosition}
        freeCamera={freeCamera}
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
