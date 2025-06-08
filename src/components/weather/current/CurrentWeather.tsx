import React, { useEffect } from "react";
import ReactTooltip from "react-tooltip";
import {
  WiHumidity,
  WiStrongWind,
  WiBarometer,
  WiSunrise,
  WiSunset,
  WiThermometerExterior,
  WiThermometer,
  WiThermometerInternal,
} from "react-icons/wi";
import {
  formatToLocalTime,
  iconUrlFromCode,
} from "../../../services/weatherService";
import "./CurrentWeather.scss";

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
}

interface CurrentWeatherProps {
  weather: WeatherData;
  units: "metric" | "imperial";
  setUnits: (units: "metric" | "imperial") => void;
}

const CurrentWeather: React.FC<CurrentWeatherProps> = ({
  weather,
  units,
  setUnits,
}) => {
  // Rebuild tooltips when component updates
  useEffect(() => {
    ReactTooltip.rebuild();
    return () => {
      ReactTooltip.hide();
    };
  }, [weather]);

  const handleUnitsClick = () => {
    setUnits(units === "metric" ? "imperial" : "metric");
  };

  return (
    <>
      <div className="main-info border">
        <p className="date-time">
          {formatToLocalTime(weather.dt, weather.timezone)}
        </p>
        <div className="wrapper">
          <div className="left-wing wing">
            <div data-tip data-for="wind" className="wing-item left">
              {`${weather.speed.toFixed()} ${
                units === "metric" ? "km/h" : "mph"
              }`}{" "}
              <WiStrongWind className="wing-icon" />
            </div>
            <ReactTooltip
              id="wind"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Wind strength</span>
            </ReactTooltip>

            <div data-tip data-for="feels-like" className="wing-item left">
              {`${weather.feels_like.toFixed()}°${
                units === "metric" ? "C" : "F"
              }`}{" "}
              <WiThermometerInternal className="wing-icon" />
            </div>
            <ReactTooltip
              id="feels-like"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Perceived temperature</span>
            </ReactTooltip>

            <div data-tip data-for="max-temp" className="wing-item left">
              {`${weather.temp_max.toFixed()}°${
                units === "metric" ? "C" : "F"
              }`}{" "}
              <WiThermometer className="wing-icon" />
            </div>
            <ReactTooltip
              id="max-temp"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Maximum temperature</span>
            </ReactTooltip>

            <div data-tip data-for="sunrise" className="wing-item left">
              {formatToLocalTime(weather.sunrise, weather.timezone, "HH:mm")}{" "}
              <WiSunrise className="wing-icon" />
            </div>
            <ReactTooltip
              id="sunrise"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Sunrise</span>
            </ReactTooltip>
          </div>

          <div className="main-middle-info">
            <img
              src={iconUrlFromCode(weather.icon)}
              alt=""
              className="weather-icon"
            />
            <p className="main-condition">{weather.details}</p>
            <h1 className="main-degrees" onClick={handleUnitsClick}>
              {`${weather.temp.toFixed()}°${units === "metric" ? "C" : "F"}`}
            </h1>
          </div>

          <div className="right-wing wing">
            <div data-tip data-for="pressure" className="wing-item">
              <WiBarometer className="wing-icon" />{" "}
              {`${weather.pressure.toFixed()}hPa`}
            </div>
            <ReactTooltip
              id="pressure"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Pressure</span>
            </ReactTooltip>

            <div data-tip data-for="humidity" className="wing-item">
              <WiHumidity className="wing-icon" />{" "}
              {`${weather.humidity.toFixed()}%`}
            </div>
            <ReactTooltip
              id="humidity"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Humidity</span>
            </ReactTooltip>

            <div data-tip data-for="min-temp" className="wing-item">
              <WiThermometerExterior className="wing-icon" />{" "}
              {`${weather.temp_min.toFixed()}°${
                units === "metric" ? "C" : "F"
              }`}
            </div>
            <ReactTooltip
              id="min-temp"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Minimum temperature</span>
            </ReactTooltip>

            <div data-tip data-for="sunset" className="wing-item">
              <WiSunset className="wing-icon" />{" "}
              {formatToLocalTime(weather.sunset, weather.timezone, "HH:mm")}
            </div>
            <ReactTooltip
              id="sunset"
              place="bottom"
              type="light"
              effect="float"
              className="tooltip"
              afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
            >
              <span>Sunset</span>
            </ReactTooltip>
          </div>
        </div>
        <p className="main-location">{`${weather.name}, ${weather.country}`}</p>
      </div>
    </>
  );
};

export default CurrentWeather;
