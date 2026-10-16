import React from "react";
import {
  formatDegrees,
  formatSpeed,
  formatUv,
  toCardinal,
} from "../../../utils/format";
import { DailyWeather, Units } from "../../../weather/types";
import { WeatherIcon } from "../../icons";
import "./WeeklyForecast.scss";

interface WeeklyForecastProps {
  items: DailyWeather[];
  units: Units;
}

export const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ items, units }) => {
  return (
    <section
      className="forecast"
      aria-label={`${items.length}-day forecast`}
      style={{ "--days": items.length } as React.CSSProperties}
    >
      {items.map((d, i) => {
        const cardinal = toCardinal(d.wind_dir);
        const windText = `${formatSpeed(d.wind_max, units)}${cardinal ? ` ${cardinal}` : ""}`;
        return (
          <article key={i} className={`day${i === 0 ? " active" : ""}`}>
            <div className="day-head">
              <span className="day-name">{d.title}</span>
              <span className="day-date">{d.date}</span>
            </div>
            <div className="day-body">
              <WeatherIcon className="day-icon" code={d.code} tinted />
              <div className="day-temps">
                <span className="day-hi">{formatDegrees(d.temp)}</span>
                <span className="day-lo">{formatDegrees(d.temp_min)}</span>
              </div>
            </div>
            <div className="day-extra">
              <div className="row">
                <span className="k">{d.details}</span>
              </div>
              <div className="row">
                <span className="k">Precip</span>
                <span className="v">{d.precip_prob}%</span>
              </div>
              <div className="row">
                <span className="k">Wind</span>
                <span className="v">{windText}</span>
              </div>
              {d.uv_max > 0 && (
                <div className="row">
                  <span className="k">UV max</span>
                  <span className="v">{formatUv(d.uv_max)}</span>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
};
