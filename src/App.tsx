import React, { useState, useEffect } from "react";
import CLOUDS from "vanta/dist/vanta.clouds.min";
import * as THREE from "three";
import { Analytics } from "@vercel/analytics/react";
import Navbar from "./components/navbar/Navbar";
import CurrentWeather from "./components/weather/current/CurrentWeather";
import WeeklyForecast from "./components/weather/weekly/WeeklyForecast";
import Footer from "./components/footer/Footer";
import getFormattedWeatherData from "./services/weatherService";
import { WeatherQuery, Units, WeatherData } from "./types/weather";

interface VantaEffect {
  destroy: () => void;
}

const App = (): React.ReactElement => {
  const [query, setQuery] = useState<WeatherQuery>({ q: "katowice" });
  const [units, setUnits] = useState<Units>("metric");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [vantaEffect, setVantaEffect] = useState<VantaEffect | null>(null);

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

  useEffect(() => {
    if (!vantaEffect) {
      setVantaEffect(
        CLOUDS({
          el: "#App",
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 850.0,
          minWidth: 1150.0,
          skyColor: 0x5bb4d7,
          cloudColor: 0xb5c1e1,
          cloudShadowColor: 0xd2c4a,
          sunColor: 0xf29c30,
          sunGlareColor: 0xf05c2b,
          sunlightColor: 0xffd3bc,
          speed: 0.5,
          THREE: THREE,
        })
      );
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  return (
    <div className="App" id="App">
      <Navbar setQuery={setQuery} />
      <section className="weather">
        {loading && <p className="loading">Loading weather data...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && weather && (
          <>
            <CurrentWeather
              weather={weather}
              units={units}
              setUnits={setUnits}
            />
            <WeeklyForecast items={weather.daily} units={units} />
          </>
        )}
      </section>
      <Footer />
      <Analytics />
    </div>
  );
};

export default App;
