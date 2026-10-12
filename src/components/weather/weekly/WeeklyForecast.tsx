import React from "react";
import {
  iconUrlFromCode,
  formatSpeed,
  toCardinal,
} from "../../../services/weatherFormatter";
import { DailyWeather, Units } from "../../../weather/types";
import "./WeeklyForecast.scss";

interface WeeklyForecastProps {
  items: DailyWeather[];
  units: Units;
}

const SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ items, units }) => {
  return (
    <section className="forecast" aria-label="6-day forecast">
      {items.slice(0, 6).map((d, i) => {
        const cardinal = toCardinal(d.wind_dir);
        const windText = `${formatSpeed(d.wind_max, units)}${cardinal ? ` ${cardinal}` : ""}`;
        return (
          <article key={i} className={`day${i === 0 ? " active" : ""}`}>
            <div className="day-head">
              <span className="day-name">{SHORT[d.title] || d.title.slice(0, 3)}</span>
              <span className="day-date">{d.date}</span>
            </div>
            <div className="day-body">
              <img
                className="day-icon"
                src={iconUrlFromCode(d.icon)}
                alt=""
                aria-hidden="true"
              />
              <div className="day-temps">
                <span className="day-hi">{`${d.temp.toFixed()}°`}</span>
                <span className="day-lo">{`${d.temp_min.toFixed()}°`}</span>
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
                  <span className="v">{d.uv_max.toFixed(1)}</span>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
};

export default WeeklyForecast;
