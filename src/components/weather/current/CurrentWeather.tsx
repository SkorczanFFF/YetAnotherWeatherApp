import React, { useMemo, useState, useEffect } from "react";
import { Tooltip } from "react-tooltip";
import { DateTime } from "luxon";
import { IconType } from "react-icons";
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
  formatTemperature,
  formatSpeed,
} from "../../../services/weatherFormatter";
import { WeatherData, Units } from "../../../weather/types";
import "./CurrentWeather.scss";

interface CurrentWeatherProps {
  weather: WeatherData;
  units: Units;
  setUnits: (units: Units) => void;
}

interface WingItem {
  id: string;
  tooltip: string;
  icon: IconType;
  valueKey: string;
}

const LEFT_WING_ITEMS: WingItem[] = [
  { id: "wind", tooltip: "Wind strength", icon: WiStrongWind, valueKey: "speed" },
  { id: "feels-like", tooltip: "Perceived temperature", icon: WiThermometerInternal, valueKey: "feelsLike" },
  { id: "max-temp", tooltip: "Maximum temperature", icon: WiThermometer, valueKey: "tempMax" },
  { id: "sunrise", tooltip: "Sunrise", icon: WiSunrise, valueKey: "sunrise" },
];

const RIGHT_WING_ITEMS: WingItem[] = [
  { id: "pressure", tooltip: "Pressure", icon: WiBarometer, valueKey: "pressure" },
  { id: "humidity", tooltip: "Humidity", icon: WiHumidity, valueKey: "humidity" },
  { id: "min-temp", tooltip: "Minimum temperature", icon: WiThermometerExterior, valueKey: "tempMin" },
  { id: "sunset", tooltip: "Sunset", icon: WiSunset, valueKey: "sunset" },
];

const TOOLTIP_PROPS = {
  "data-tooltip-position-strategy": "fixed" as const,
  "data-tooltip-float": true,
};

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

  const formatted: Record<string, string> = useMemo(() => ({
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

  const unitSwitchLabel = units === "metric"
    ? "Click to switch temperature unit to Fahrenheit"
    : "Click to switch temperature unit to Celsius";

  const renderWingItem = (item: WingItem, side: "left" | "right") => {
    const Icon = item.icon;
    return (
      <React.Fragment key={item.id}>
        <div data-tooltip-id={item.id} {...TOOLTIP_PROPS} className={`wing-item ${side}`}>
          {side === "left" ? (
            <>{formatted[item.valueKey]} <Icon className="wing-icon" /></>
          ) : (
            <><Icon className="wing-icon" /> {formatted[item.valueKey]}</>
          )}
        </div>
        <Tooltip id={item.id} place="bottom" variant="light" className="current-weather-tooltip" delayHide={50} content={item.tooltip} />
      </React.Fragment>
    );
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
            {LEFT_WING_ITEMS.map((item) => renderWingItem(item, "left"))}
          </div>

          <div className="main-middle-info">
            <img
              src={iconUrlFromCode(weather.icon)}
              alt={weather.details}
              className="weather-icon"
            />
            <p className="main-condition">{weather.details}</p>
            <button
              type="button"
              className="main-degrees"
              onClick={handleUnitsClick}
              aria-label={unitSwitchLabel}
              data-tooltip-id="unit-switch"
              {...TOOLTIP_PROPS}
            >
              {formatted.temp}
            </button>
            <Tooltip
              id="unit-switch"
              place="bottom"
              variant="light"
              className="current-weather-tooltip"
              delayHide={50}
              content={unitSwitchLabel}
            />
          </div>

          <div className="right-wing wing">
            {RIGHT_WING_ITEMS.map((item) => renderWingItem(item, "right"))}
          </div>
        </div>
        <p className="main-location">{formatted.location}</p>
      </div>
  );
};

export default CurrentWeather;
