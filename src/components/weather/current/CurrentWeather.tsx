import React, { useEffect, useId, useMemo, useState } from "react";
import { DateTime } from "luxon";
import {
  formatToLocalTime,
  formatTemperature,
  formatSpeed,
  tempSymbol,
  toCardinal,
} from "../../../utils/format";
import { CLOUD_PATH, LineIcon, PinIcon, WeatherIcon } from "../../icons";
import { WeatherData, Units } from "../../../weather/types";
import { clamp01 } from "../../../utils/math";
import "./CurrentWeather.scss";

interface CurrentWeatherProps {
  weather: WeatherData;
  units: Units;
}

const DAY_SECONDS = 24 * 60 * 60;

const uvLabel = (uv?: number): string => {
  if (uv == null) return "";
  if (uv < 3) return "low";
  if (uv < 6) return "mod";
  if (uv < 8) return "high";
  if (uv < 11) return "v.high";
  return "extreme";
};

const getLiveTimeParts = (timezone: string) => {
  const now = DateTime.now().setZone(timezone);
  return {
    datePart: now.toFormat("cccc, dd LLLL yyyy"),
    timePart: now.toFormat("HH:mm"),
    nowSeconds: now.toSeconds(),
  };
};

const visibilityKm = (m?: number) => {
  if (m == null) return "—";
  if (m >= 1000) return (m / 1000).toFixed(0);
  return (m / 1000).toFixed(1);
};

// Sun/moon arc: a quadratic Bézier from (ARC_X0, ARC_Y) over ARC_PEAK_Y to (ARC_X1, ARC_Y).
const ARC_VB_W = 200;
const ARC_VB_H = 40;
const ARC_X0 = 4;
const ARC_X1 = ARC_VB_W - ARC_X0;
const ARC_Y = 36;
const ARC_PEAK_Y = -12;
const ARC_PATH = `M${ARC_X0} ${ARC_Y} Q ${ARC_VB_W / 2} ${ARC_PEAK_Y} ${ARC_X1} ${ARC_Y}`;
const arcAt = (t: number) => ({
  x: ARC_X0 + (ARC_X1 - ARC_X0) * t,
  y: (1 - t) * (1 - t) * ARC_Y + 2 * t * (1 - t) * ARC_PEAK_Y + t * t * ARC_Y,
});

export const CurrentWeather: React.FC<CurrentWeatherProps> = ({ weather, units }) => {
  const [live, setLive] = useState(() => getLiveTimeParts(weather.timezone));
  const arcClipId = `arc-clip${useId()}`;

  useEffect(() => {
    const tick = () => setLive(getLiveTimeParts(weather.timezone));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [weather.timezone]);

  const arc = useMemo(() => {
    const now = live.nowSeconds;
    const sunrise = weather.sunrise;
    const sunset = weather.sunset;
    const isDaytime = now >= sunrise && now < sunset;
    if (isDaytime) {
      const t = clamp01((now - sunrise) / (sunset - sunrise || 1));
      return {
        mode: "day" as const,
        leftLabel: "Sunrise",
        leftTime: sunrise,
        rightLabel: "Sunset",
        rightTime: sunset,
        progress: t,
      };
    }
    // Night phase
    const isAfterSunset = now >= sunset;
    const start = isAfterSunset ? sunset : (sunset - DAY_SECONDS);
    const end = isAfterSunset
      ? (weather.next_sunrise ?? sunrise + DAY_SECONDS)
      : sunrise;
    const span = end - start || 1;
    const t = clamp01((now - start) / span);
    return {
      mode: "night" as const,
      leftLabel: "Sunset",
      leftTime: start,
      rightLabel: "Sunrise",
      rightTime: end,
      progress: t,
    };
  }, [weather.sunrise, weather.sunset, weather.next_sunrise, live.nowSeconds]);

  const formatted = useMemo(() => ({
    feels: formatTemperature(weather.feels_like, units),
    high: formatTemperature(weather.temp_max, units),
    low: formatTemperature(weather.temp_min, units),
    wind: formatSpeed(weather.speed, units),
    humidity: `${weather.humidity.toFixed()}`,
    pressure: `${weather.pressure.toFixed()}`,
    leftTime: formatToLocalTime(arc.leftTime, weather.timezone, "HH:mm"),
    rightTime: formatToLocalTime(arc.rightTime, weather.timezone, "HH:mm"),
    windDir: toCardinal(weather.wind_direction) || "—",
    cloudCover: weather.cloud_cover != null ? `${weather.cloud_cover.toFixed()}` : "—",
    visibility: visibilityKm(weather.visibility),
    uv: weather.uv_index != null ? weather.uv_index.toFixed(1) : "—",
    uvLabel: uvLabel(weather.uv_index),
    dew: weather.dew_point != null ? formatTemperature(weather.dew_point, units) : "—",
    precip: weather.precipitation != null ? weather.precipitation.toFixed(1) : "0.0",
  }), [weather, units, arc]);

  const arcPt = arcAt(arc.progress);
  const arcColorClass = arc.mode === "night" ? "is-night" : "is-day";

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
            <span className="kv"><span className="k">Feels</span><span className="v">{formatted.feels}</span></span>
            <span className="kv"><span className="k">High</span><span className="v">{formatted.high}</span></span>
            <span className="kv"><span className="k">Low</span><span className="v">{formatted.low}</span></span>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <LineIcon className="icon">
              <path d="M3 8h10a3 3 0 1 0-3-3" /><path d="M3 12h15a3 3 0 1 1-3 3" /><path d="M3 16h8" />
            </LineIcon>
            <div className="info">
              <span className="label">Wind</span>
              <span className="value">{formatted.wind}<span className="u"> {formatted.windDir}</span></span>
            </div>
          </div>
          <div className="stat">
            <LineIcon className="icon">
              <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />
            </LineIcon>
            <div className="info">
              <span className="label">Humidity</span>
              <span className="value">{formatted.humidity}<span className="u">%</span></span>
            </div>
          </div>
          <div className="stat">
            <LineIcon className="icon">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </LineIcon>
            <div className="info">
              <span className="label">Pressure</span>
              <span className="value">{formatted.pressure}<span className="u"> hPa</span></span>
            </div>
          </div>
          <div className="stat">
            <LineIcon className="icon">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
            </LineIcon>
            <div className="info">
              <span className="label">UV index</span>
              <span className="value">{formatted.uv}<span className="u"> {formatted.uvLabel}</span></span>
            </div>
          </div>
          <div className="stat">
            <LineIcon className="icon">
              <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
            </LineIcon>
            <div className="info">
              <span className="label">Visibility</span>
              <span className="value">{formatted.visibility}<span className="u"> km</span></span>
            </div>
          </div>
          <div className="stat">
            <LineIcon className="icon">
              <path d={CLOUD_PATH} />
            </LineIcon>
            <div className="info">
              <span className="label">Cloud cover</span>
              <span className="value">{formatted.cloudCover}<span className="u">%</span></span>
            </div>
          </div>
          <div className="stat">
            <LineIcon className="icon">
              <path d="M6 14a6 6 0 0 1 12 0" />
              <path d="M12 18v3" /><path d="M8 19l-1 2" /><path d="M16 19l1 2" />
            </LineIcon>
            <div className="info">
              <span className="label">Precip.</span>
              <span className="value">{formatted.precip}<span className="u"> mm</span></span>
            </div>
          </div>
          <div className="stat">
            <LineIcon className="icon">
              <path d="M4 14h16" /><path d="M7 14a5 5 0 0 1 10 0" /><path d="M12 4v4" /><path d="m9 6 3-3 3 3" />
            </LineIcon>
            <div className="info">
              <span className="label">Dew point</span>
              <span className="value">{formatted.dew}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`sun-bar ${arcColorClass}`}>
        <div className="sun-end sun-end--start">
          <div>
            <div className="sun-label">{arc.leftLabel}</div>
            <div>{formatted.leftTime}</div>
          </div>
        </div>
        <div className="sun-track" aria-hidden="true">
          <svg
            className="arc-svg"
            viewBox={`0 0 ${ARC_VB_W} ${ARC_VB_H}`}
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath id={arcClipId}>
                <rect
                  x="0"
                  y="0"
                  width={arc.progress * ARC_VB_W}
                  height={ARC_VB_H}
                />
              </clipPath>
            </defs>
            <path className="arc-bg" d={ARC_PATH} />
            <path
              className="arc-done"
              d={ARC_PATH}
              clipPath={`url(#${arcClipId})`}
            />
          </svg>
          <div
            className="sun-marker"
            style={{
              left: `${(arcPt.x / ARC_VB_W) * 100}%`,
              top: `${(arcPt.y / ARC_VB_H) * 100}%`,
            }}
          >
            {arc.mode === "day" ? (
              <svg className="sun-glyph" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" fill="currentColor" />
              </svg>
            ) : (
              <svg className="moon-glyph" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="7" className="moon-body" />
                <circle cx="15" cy="10.5" r="6" className="moon-shadow" />
              </svg>
            )}
          </div>
        </div>
        <div className="sun-end sun-end--end">
          <div>
            <div className="sun-label">{arc.rightLabel}</div>
            <div>{formatted.rightTime}</div>
          </div>
        </div>
      </div>
    </section>
  );
};
