import React from "react";
import { formatTemperature, tempSymbol } from "../../../utils/format";
import { PinIcon, WeatherIcon } from "../../icons";
import { WeatherData, Units } from "../../../weather/types";
import { useLiveClock } from "../../../hooks/useLiveClock";
import { HeroStats } from "./HeroStats";
import { SunArc } from "./SunArc";
import "./CurrentWeather.scss";

interface CurrentWeatherProps {
  weather: WeatherData;
  units: Units;
}

export const CurrentWeather: React.FC<CurrentWeatherProps> = ({ weather, units }) => {
  const live = useLiveClock(weather.timezone);

  return (
    <section className="hero">
      <div className="meta-row">
        <span className="pin">
          <PinIcon strokeWidth={2} />
        </span>
        <span>{live.datePart}</span>
        <span className="sep" aria-hidden="true" />
        <span>{live.timePart}</span>
      </div>

      <div className="hero-core">
        <div className="hero-temp-wrap">
          <div className="location">
            {weather.name}
            {weather.country && (
              <span className="country">, {weather.country}</span>
            )}
          </div>
          <div className="condition">
            <WeatherIcon className="cond-icon" code={weather.weather_code} isDay={weather.is_day !== 0} />
            <span>{weather.details}</span>
          </div>
          <div className="temp">
            <span>{Math.round(weather.temp)}</span>
            <span className="deg">{tempSymbol(units)}</span>
          </div>
          <div className="temp-sub">
            <span className="kv"><span className="k">Feels</span><span className="v">{formatTemperature(weather.feels_like, units)}</span></span>
            <span className="kv"><span className="k">High</span><span className="v">{formatTemperature(weather.temp_max, units)}</span></span>
            <span className="kv"><span className="k">Low</span><span className="v">{formatTemperature(weather.temp_min, units)}</span></span>
          </div>
        </div>

        <HeroStats weather={weather} units={units} />
      </div>

      <SunArc weather={weather} nowSeconds={live.nowSeconds} />
    </section>
  );
};
