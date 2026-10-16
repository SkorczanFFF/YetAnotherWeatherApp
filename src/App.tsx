import React, { useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { ToastContainer } from "react-toastify";
import { Navbar } from "./components/navbar/Navbar";
import { CurrentWeather } from "./components/weather/current/CurrentWeather";
import { HourlyChart } from "./components/weather/hourly/HourlyChart";
import { WeeklyForecast } from "./components/weather/weekly/WeeklyForecast";
import { WeatherSceneContainer } from "./weather-scene/WeatherSceneContainer";
import { DebugMenu } from "./components/debug-menu/DebugMenu";
import { MapPicker } from "./components/map-picker/MapPicker";
import { LoaderPanel, LoaderPill } from "./components/loader/Loader";
import { useDebugToggle } from "./hooks/useDebugToggle";
import { useGlassSpotlight } from "./hooks/useGlassSpotlight";
import { useWeather } from "./hooks/useWeather";
import { DEFAULT_LOCATION, mapToSceneParams } from "./weather/sceneParams";
import { isOverridesDirty, type SceneOverrides } from "./weather/overrides";
import { formatCoords, formatGmtOffset, formatLatLon, tempSymbol } from "./utils/format";
import type { LoadSource, Units, WeatherQuery } from "./weather/types";

const describeQuery = (query: WeatherQuery): string =>
  query.q
    ? query.q.charAt(0).toUpperCase() + query.q.slice(1)
    : formatCoords(query.lat ?? 0, query.lon ?? 0);

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

const App = (): React.ReactElement => {
  useGlassSpotlight();
  const [query, setQuery] = useState<WeatherQuery>({ q: DEFAULT_LOCATION.name });
  const [units, setUnits] = useState<Units>("metric");
  const { weather, weatherUnits, loading, error } = useWeather(query, units);
  const [loadSource, setLoadSource] = useState<LoadSource>("initial");
  const { open: debugOpen, setOpen: setDebugOpen, onTap: handleStatusTap } = useDebugToggle();
  const [debugOverrides, setDebugOverrides] = useState<SceneOverrides | null>(null);
  const [showPerf, setShowPerf] = useState(true);
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
      <WeatherSceneContainer
        params={effectiveParams}
        showPerf={debugOpen && showPerf}
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
          <div
            className={`stack${refreshing ? " is-refreshing" : ""}`}
            aria-busy={loading}
            // The scene keeps the sun and moon out from behind this column.
            data-scene-cover
          >
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
                      <span>{formatLatLon(weather.lat, weather.lon)}</span>
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
        initialCenter={weather ? [weather.lat, weather.lon] : undefined}
      />
      <DebugMenu
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        overrides={debugOverrides}
        onOverridesChange={setDebugOverrides}
        currentParams={currentParams}
        effectiveParams={effectiveParams}
        showPerf={showPerf}
        onShowPerfChange={setShowPerf}
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
