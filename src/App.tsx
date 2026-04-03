import React, { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import Navbar from "./components/navbar/Navbar";
import CurrentWeather from "./components/weather/current/CurrentWeather";
import WeeklyForecast from "./components/weather/weekly/WeeklyForecast";
import Footer from "./components/footer/Footer";
import WeatherScene from "./components/weather-scene/WeatherSceneContainer";
import DebugMenu, { isOverridesDirty } from "./components/debug-menu/DebugMenu";
import { MapPicker } from "./components/map-picker/MapPicker";
import { type DebugOverrides, mapToSimulationConfig } from "./weather/config";
import type { DebugBoxPosition } from "./weather-scene/scene/DebugBox";
import getFormattedWeatherData from "./services/weatherService";
import { WeatherError } from "./services/errors";
import { type SimulationConfig, type WeatherQuery, type Units, type WeatherData } from "./weather/types";

const MIN_LOADING_MS = 500;

const App = (): React.ReactElement => {
  const [query, setQuery] = useState<WeatherQuery>({ q: "katowice" });
  const [units, setUnits] = useState<Units>("metric");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugOverrides, setDebugOverrides] = useState<DebugOverrides | null>(
    null
  );
  const [debugBoxPosition, setDebugBoxPosition] = useState<DebugBoxPosition>({
    x: 0,
    y: 0,
    z: 0,
  });
  const [freeCamera, setFreeCamera] = useState(false);
  const [mapPanelOpen, setMapPanelOpen] = useState(false);
  const isDebugMode = isOverridesDirty(debugOverrides);
  const currentConfig = React.useMemo<SimulationConfig | null>(
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

  return (
    <div className="App" id="App">
      <WeatherScene
        weather={weather}
        overrides={debugOverrides}
        showDebugBox={debugOpen}
        debugBoxPosition={debugBoxPosition}
        freeCamera={freeCamera}
      />
      <Navbar
        setQuery={setQuery}
        isDebugMode={isDebugMode}
        onOpenMapPicker={() => setMapPanelOpen(true)}
      />
      <section className={`weather${loading ? " is-loading" : ""}`}>
        {error && <p className="error">{error}</p>}
        {weather && (
          <>
            <CurrentWeather
              weather={weather}
              units={units}
              setUnits={setUnits}
            />
            <WeeklyForecast items={weather.daily} />
          </>
        )}
        {loading && (
          <div className="loading" aria-live="polite" aria-busy="true">
            <div className="loader" aria-hidden="true" />
          </div>
        )}
      </section>
      <Footer />
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
    </div>
  );
};

export default App;
