import React, { useState, useEffect } from "react";
import CLOUDS from "vanta/dist/vanta.clouds.min";
import * as THREE from "three";
import Navbar from "./components/navbar/Navbar";
import CurrentWeather from "./components/weather/current/CurrentWeather";
import WeeklyForecast from "./components/weather/weekly/WeeklyForecast";
import Footer from "./components/footer/Footer";
import getFormattedWeatherData from "./services/weatherService";

interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}

interface VantaEffect {
  destroy: () => void;
}

type Units = "metric" | "imperial";

interface WeatherData {
  dt: number;
  timezone: string;
  name: string;
  country: string;
  temp: number;
  temp_max: number;
  temp_min: number;
  pressure: number;
  feels_like: number;
  sunrise: number;
  sunset: number;
  humidity: number;
  speed: number;
  details: string;
  icon: string;
  daily: Array<{
    title: string;
    temp: number;
    temp_min: number;
    icon: string;
  }>;
}

const App = (): React.ReactElement => {
  const [query, setQuery] = useState<WeatherQuery>({ q: "katowice" });
  const [units, setUnits] = useState<Units>("metric");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [vantaEffect, setVantaEffect] = useState<VantaEffect | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      console.log("fetching weather for " + query.q);
      try {
        const data = await getFormattedWeatherData({ ...query, units });
        setWeather(data);
        console.log(`Fetched weather for ${data.name}, ${data.country}.`);
      } catch (error) {
        console.error("Error fetching weather:", error);
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
      <Navbar setQuery={setQuery} units={units} setUnits={setUnits} />
      <section className="weather">
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
      </section>
      <Footer />
    </div>
  );
};

export default App;
