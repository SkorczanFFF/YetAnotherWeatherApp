import React from "react";
import { iconUrlFromCode } from "../../../services/weatherService";
import "./WeeklyForecast.scss";

interface DailyWeather {
  title: string;
  temp: number;
  temp_min: number;
  icon: string;
}

interface WeeklyForecastProps {
  items: DailyWeather[];
  units: "metric" | "imperial";
}

const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ items, units }) => {
  return (
    <div className="weekly-forecast border">
      {items.map((item, idx) => (
        <div key={idx} className="daily-item">
          <p className="day">{item.title}</p>
          <img src={iconUrlFromCode(item.icon)} alt="" className="icon-small" />
          <div className="temp">
            <p className="temp-max">
              {`${item.temp.toFixed()}°${units === "metric" ? "C" : "F"}`}
            </p>
            <p className="temp-min">
              {`${item.temp_min.toFixed()}°${units === "metric" ? "C" : "F"}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeeklyForecast;
