import React, { useId } from "react";
import { formatToLocalTime } from "../../../utils/format";
import { clamp01 } from "../../../utils/math";
import type { WeatherData } from "../../../weather/types";

const DAY_SECONDS = 24 * 60 * 60;

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

interface ArcWindow {
  mode: "day" | "night";
  leftLabel: string;
  leftTime: number;
  rightLabel: string;
  rightTime: number;
  /** 0..1 through the window. */
  progress: number;
}

/** Sunrise → sunset by day; sunset → sunrise by night (Unix seconds). */
function arcWindow(now: number, sunrise: number, sunset: number, nextSunrise?: number): ArcWindow {
  if (now >= sunrise && now < sunset) {
    return {
      mode: "day",
      leftLabel: "Sunrise",
      leftTime: sunrise,
      rightLabel: "Sunset",
      rightTime: sunset,
      progress: clamp01((now - sunrise) / (sunset - sunrise || 1)),
    };
  }
  // Before dawn, the previous sunset is approximated as today's minus a day.
  const isAfterSunset = now >= sunset;
  const start = isAfterSunset ? sunset : sunset - DAY_SECONDS;
  const end = isAfterSunset ? (nextSunrise ?? sunrise + DAY_SECONDS) : sunrise;
  return {
    mode: "night",
    leftLabel: "Sunset",
    leftTime: start,
    rightLabel: "Sunrise",
    rightTime: end,
    progress: clamp01((now - start) / (end - start || 1)),
  };
}

interface SunArcProps {
  weather: WeatherData;
  nowSeconds: number;
}

/** The day's (or night's) arc with the sun or moon on it and the times at both ends. */
export const SunArc: React.FC<SunArcProps> = ({ weather, nowSeconds }) => {
  const clipId = `arc-clip${useId()}`;
  const arc = arcWindow(nowSeconds, weather.sunrise, weather.sunset, weather.next_sunrise);
  const point = arcAt(arc.progress);
  return (
    <div className={`sun-bar ${arc.mode === "night" ? "is-night" : "is-day"}`}>
      <div className="sun-end sun-end--start">
        <div>
          <div className="sun-label">{arc.leftLabel}</div>
          <div>{formatToLocalTime(arc.leftTime, weather.timezone, "HH:mm")}</div>
        </div>
      </div>
      <div className="sun-track" aria-hidden="true">
        <svg
          className="arc-svg"
          viewBox={`0 0 ${ARC_VB_W} ${ARC_VB_H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={clipId}>
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
            clipPath={`url(#${clipId})`}
          />
        </svg>
        <div
          className="sun-marker"
          style={{
            left: `${(point.x / ARC_VB_W) * 100}%`,
            top: `${(point.y / ARC_VB_H) * 100}%`,
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
          <div>{formatToLocalTime(arc.rightTime, weather.timezone, "HH:mm")}</div>
        </div>
      </div>
    </div>
  );
};
