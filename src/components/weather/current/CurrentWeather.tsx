import React, { useMemo, useState, useEffect } from "react";
import { Tooltip } from "react-tooltip";
import { DateTime } from "luxon";
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
} from "../../../services/weatherFormatter";
import { WeatherData, Units } from "../../../weather/types";
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
    className="current-weather-tooltip"
    delayHide={50}
    content={content}
  />
);

const getLiveTimeParts = (timezone: string) => {
  const now = DateTime.now().setZone(timezone);
  return {
    datePart: now.toFormat("cccc, dd LLLL yyyy"),
    hours: now.toFormat("HH"),
    minutes: now.toFormat("mm"),
  };
};

const CurrentWeather: React.FC<CurrentWeatherProps> = ({
  weather,
  units,
  setUnits,
}) => {
  const [liveTime, setLiveTime] = useState(() => getLiveTimeParts(weather.timezone));

  useEffect(() => {
    const tick = () => setLiveTime(getLiveTimeParts(weather.timezone));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [weather.timezone]);

  const formatted = useMemo(() => ({
    speed: formatSpeed(weather.speed, units),
    feelsLike: formatTemperature(weather.feels_like, units),
    tempMax: formatTemperature(weather.temp_max, units),
    temp: formatTemperature(weather.temp, units),
    tempMin: formatTemperature(weather.temp_min, units),
    pressure: `${weather.pressure.toFixed()}hPa`,
    humidity: `${weather.humidity.toFixed()}%`,
    sunrise: formatToLocalTime(weather.sunrise, weather.timezone, "HH:mm"),
    sunset: formatToLocalTime(weather.sunset, weather.timezone, "HH:mm"),
    location: `${weather.name}, ${weather.country}`,
  }), [weather, units]);

  const handleUnitsClick = () => {
    setUnits(units === "metric" ? "imperial" : "metric");
  };

  return (
    <div className="main-info border">
        <p className="date-time" aria-live="polite">
          {liveTime.datePart}, {liveTime.hours}
          <span className="date-time-colon" aria-hidden="true">:</span>
          {liveTime.minutes}
        </p>
        <div className="wrapper">
          <div className="left-wing wing">
            <div data-tooltip-id="wind" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item left">
              {formatted.speed}{" "}
              <WiStrongWind className="wing-icon" />
            </div>
            <WeatherTooltip id="wind" content="Wind strength" />

            <div data-tooltip-id="feels-like" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item left">
              {formatted.feelsLike}{" "}
              <WiThermometerInternal className="wing-icon" />
            </div>
            <WeatherTooltip id="feels-like" content="Perceived temperature" />

            <div data-tooltip-id="max-temp" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item left">
              {formatted.tempMax}{" "}
              <WiThermometer className="wing-icon" />
            </div>
            <WeatherTooltip id="max-temp" content="Maximum temperature" />

            <div data-tooltip-id="sunrise" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item left">
              {formatted.sunrise}{" "}
              <WiSunrise className="wing-icon" />
            </div>
            <WeatherTooltip id="sunrise" content="Sunrise" />
          </div>

          <div className="main-middle-info">
            <img
              src={iconUrlFromCode(weather.icon)}
              alt={weather.details}
              className="weather-icon"
            />
            <p className="main-condition">{weather.details}</p>
            <h1
              className="main-degrees"
              onClick={handleUnitsClick}
              role="button"
              tabIndex={0}
              aria-label={
                units === "metric"
                  ? "Click to switch temperature unit to Fahrenheit"
                  : "Click to switch temperature unit to Celsius"
              }
              data-tooltip-id="unit-switch"
              data-tooltip-position-strategy="fixed"
              data-tooltip-float={true}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleUnitsClick();
                }
              }}
            >
              {formatted.temp}
            </h1>
            <WeatherTooltip
              id="unit-switch"
              content={
                units === "metric"
                  ? "Click to switch temperature unit to Fahrenheit"
                  : "Click to switch temperature unit to Celsius"
              }
            />
          </div>

          <div className="right-wing wing">
            <div data-tooltip-id="pressure" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item right">
              <WiBarometer className="wing-icon" />{" "}
              {formatted.pressure}
            </div>
            <WeatherTooltip id="pressure" content="Pressure" />

            <div data-tooltip-id="humidity" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item right">
              <WiHumidity className="wing-icon" />{" "}
              {formatted.humidity}
            </div>
            <WeatherTooltip id="humidity" content="Humidity" />

            <div data-tooltip-id="min-temp" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item right">
              <WiThermometerExterior className="wing-icon" />{" "}
              {formatted.tempMin}
            </div>
            <WeatherTooltip id="min-temp" content="Minimum temperature" />

            <div data-tooltip-id="sunset" data-tooltip-position-strategy="fixed" data-tooltip-float={true} className="wing-item right">
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
