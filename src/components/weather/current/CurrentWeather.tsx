import React, { useMemo } from "react";
import { Tooltip } from "react-tooltip";
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
import { WeatherData, Units } from "../../../types/weather";
import "./CurrentWeather.scss";

interface CurrentWeatherProps {
  weather: WeatherData;
  units: Units;
  setUnits: (units: Units) => void;
}

const formatTemperature = (value: number, units: Units): string =>
  `${value.toFixed()}°${units === "metric" ? "C" : "F"}`;

const formatSpeed = (value: number, units: Units): string =>
  `${value.toFixed()} ${units === "metric" ? "km/h" : "mph"}`;

interface WeatherTooltipProps {
  id: string;
  content: string;
}

const WeatherTooltip: React.FC<WeatherTooltipProps> = ({ id, content }) => (
  <Tooltip
    id={id}
    place="bottom"
    variant="light"
    className="tooltip"
    delayHide={2000}
    content={content}
  />
);

const CurrentWeather: React.FC<CurrentWeatherProps> = ({
  weather,
  units,
  setUnits,
}) => {
  const formatted = useMemo(() => ({
    speed: formatSpeed(weather.speed, units),
    feelsLike: formatTemperature(weather.feels_like, units),
    tempMax: formatTemperature(weather.temp_max, units),
    temp: formatTemperature(weather.temp, units),
    tempMin: formatTemperature(weather.temp_min, units),
    pressure: `${weather.pressure.toFixed()}hPa`,
    humidity: `${weather.humidity.toFixed()}%`,
    dateTime: formatToLocalTime(weather.dt, weather.timezone),
    sunrise: formatToLocalTime(weather.sunrise, weather.timezone, "HH:mm"),
    sunset: formatToLocalTime(weather.sunset, weather.timezone, "HH:mm"),
    location: `${weather.name}, ${weather.country}`,
  }), [weather, units]);

  const handleUnitsClick = () => {
    setUnits(units === "metric" ? "imperial" : "metric");
  };

  return (
    <div className="main-info border">
        <p className="date-time">
          {formatted.dateTime}
        </p>
        <div className="wrapper">
          <div className="left-wing wing">
            <div data-tooltip-id="wind" className="wing-item left">
              {formatted.speed}{" "}
              <WiStrongWind className="wing-icon" />
            </div>
            <WeatherTooltip id="wind" content="Wind strength" />

            <div data-tooltip-id="feels-like" className="wing-item left">
              {formatted.feelsLike}{" "}
              <WiThermometerInternal className="wing-icon" />
            </div>
            <WeatherTooltip id="feels-like" content="Perceived temperature" />

            <div data-tooltip-id="max-temp" className="wing-item left">
              {formatted.tempMax}{" "}
              <WiThermometer className="wing-icon" />
            </div>
            <WeatherTooltip id="max-temp" content="Maximum temperature" />

            <div data-tooltip-id="sunrise" className="wing-item left">
              {formatted.sunrise}{" "}
              <WiSunrise className="wing-icon" />
            </div>
            <WeatherTooltip id="sunrise" content="Sunrise" />
          </div>

          <div className="main-middle-info">
            <img
              src={iconUrlFromCode(weather.icon)}
              alt=""
              className="weather-icon"
            />
            <p className="main-condition">{weather.details}</p>
            <h1 className="main-degrees" onClick={handleUnitsClick}>
              {formatted.temp}
            </h1>
          </div>

          <div className="right-wing wing">
            <div data-tooltip-id="pressure" className="wing-item">
              <WiBarometer className="wing-icon" />{" "}
              {formatted.pressure}
            </div>
            <WeatherTooltip id="pressure" content="Pressure" />

            <div data-tooltip-id="humidity" className="wing-item">
              <WiHumidity className="wing-icon" />{" "}
              {formatted.humidity}
            </div>
            <WeatherTooltip id="humidity" content="Humidity" />

            <div data-tooltip-id="min-temp" className="wing-item">
              <WiThermometerExterior className="wing-icon" />{" "}
              {formatted.tempMin}
            </div>
            <WeatherTooltip id="min-temp" content="Minimum temperature" />

            <div data-tooltip-id="sunset" className="wing-item">
              <WiSunset className="wing-icon" />{" "}
              {formatted.sunset}
            </div>
            <WeatherTooltip id="sunset" content="Sunset" />
          </div>
        </div>
        <p className="main-location">{formatted.location}</p>
      </div>
  );
};

export default CurrentWeather;
