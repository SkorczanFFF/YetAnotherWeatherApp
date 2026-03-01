import React, { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import Navbar from "./components/navbar/Navbar";
import CurrentWeather from "./components/weather/current/CurrentWeather";
import WeeklyForecast from "./components/weather/weekly/WeeklyForecast";
import Footer from "./components/footer/Footer";
import WeatherScene from "./components/weather-scene/WeatherScene";
import DebugMenu, { isOverridesDirty } from "./components/debug-menu/DebugMenu";
import type { DebugOverrides } from "./weather/config";
import type { DebugBoxPosition } from "./weather-scene/scene/DebugBox";
import type { CloudSpawnBounds } from "./weather-scene/scene/CloudSpawnDebugBox";
import getFormattedWeatherData from "./services/weatherService";
import { WeatherQuery, Units, WeatherData } from "./types/weather";

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
  const [cloudSpawnBounds, setCloudSpawnBounds] =
    useState<CloudSpawnBounds | null>(null);
  const isDebugMode = isOverridesDirty(debugOverrides);

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
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getFormattedWeatherData({ ...query, units });
        setWeather(data);
      } catch (err) {
        setError("Failed to fetch weather data. Please try again.");
        console.error("Error fetching weather:", err);
      } finally {
        setLoading(false);
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
        onCloudSpawnBoundsChange={setCloudSpawnBounds}
      />
      <Navbar setQuery={setQuery} isDebugMode={isDebugMode} />
      <section className={`weather xray${loading ? " is-loading" : ""}`}>
        {error && <p className="error">{error}</p>}
        {weather && (
          <>
            <CurrentWeather
              weather={weather}
              units={units}
              setUnits={setUnits}
            />
            <WeeklyForecast items={weather.daily} units={units} />
          </>
        )}
        {loading && (
          <div className="loading" aria-live="polite" aria-busy="true">
            <div className="loader" aria-hidden="true" />
          </div>
        )}
      </section>
      <Footer />
      <DebugMenu
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        overrides={debugOverrides}
        onOverridesChange={setDebugOverrides}
        debugBoxPosition={debugBoxPosition}
        onDebugBoxPositionChange={setDebugBoxPosition}
        cloudSpawnBounds={cloudSpawnBounds}
      />
      <Analytics />
    </div>
  );
};

export default App;
