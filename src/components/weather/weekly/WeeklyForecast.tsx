import React from "react";
import { iconUrlFromCode } from "../../../services/weatherFormatter";
import { DailyWeather } from "../../../weather/types";
import "./WeeklyForecast.scss";

interface WeeklyForecastProps {
  items: DailyWeather[];
}

const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ items }) => {
  return (
    <div className="weekly-container">
        <p className="forecast-info">
          Weekly <u>forecast</u>
        </p>
        <div className="weekly-items">
          {items.map((item, index) => (
            <article key={index} className="atom atom-left border-light">
              <p className="weekday">{item.title}</p>
              <img
                src={iconUrlFromCode(item.icon)}
                alt={item.title}
                className="weekly-weather-icon"
              />
              <div className="weekly-temp-container">
                <h5 className="weekly-temp">{`${item.temp.toFixed()}°`}</h5>
                <h5 className="feels-like-temp">{`${item.temp_min.toFixed()}°`}</h5>
              </div>
            </article>
          ))}
        </div>
      </div>
  );
};

export default WeeklyForecast;
