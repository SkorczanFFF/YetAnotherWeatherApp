import React from "react";
import { iconUrlFromCode } from "../../../services/weatherService";
import "./WeeklyForecast.scss";

interface DailyWeather {
  title: string;
  temp: number;
  temp_min: number;
  icon: string;
}

type Units = "metric" | "imperial";

interface WeeklyForecastProps {
  items: DailyWeather[];
  units: Units;
}

const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ items, units }) => {
  console.log(items);
  return (
    <>
      <div className="weekly-container">
        <p className="forecast-info">
          Weekly <u>forecast</u>
        </p>
        <div className="weekly-items">
          {items.map((item, index) => (
            <div key={index} className="atom atom-left border-light">
              <p className="weekday">{item.title}</p>
              <img
                src={iconUrlFromCode(item.icon)}
                alt=""
                className="weekly-weather-icon"
              />
              <div className="weekly-temp-container">
                <h5 className="weekly-temp">{`${item.temp.toFixed()}°`}</h5>
                <h5 className="feels-like-temp">{`${item.temp_min.toFixed()}°`}</h5>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default WeeklyForecast;
