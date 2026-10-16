import React from "react";
import { formatSpeed, formatTemperature, formatUv, toCardinal } from "../../../utils/format";
import type { Units, WeatherData } from "../../../weather/types";
import { CLOUD_PATH, LineIcon } from "../../icons";

const uvLabel = (uv?: number): string => {
  if (uv == null) return "";
  if (uv < 3) return "low";
  if (uv < 6) return "mod";
  if (uv < 8) return "high";
  if (uv < 11) return "v.high";
  return "extreme";
};

const visibilityKm = (m?: number) => {
  if (m == null) return "—";
  if (m >= 1000) return (m / 1000).toFixed(0);
  return (m / 1000).toFixed(1);
};

interface Stat {
  label: string;
  icon: React.ReactNode;
  value: string;
  /** Unit after the value, spacing included; none for a value that carries its own. */
  unit?: string;
}

function stats(weather: WeatherData, units: Units): Stat[] {
  return [
    {
      label: "Wind",
      icon: <><path d="M3 8h10a3 3 0 1 0-3-3" /><path d="M3 12h15a3 3 0 1 1-3 3" /><path d="M3 16h8" /></>,
      value: formatSpeed(weather.speed, units),
      unit: ` ${toCardinal(weather.wind_direction) || "—"}`,
    },
    {
      label: "Humidity",
      icon: <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />,
      value: `${weather.humidity.toFixed()}`,
      unit: "%",
    },
    {
      label: "Pressure",
      icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
      value: `${weather.pressure.toFixed()}`,
      unit: " hPa",
    },
    {
      label: "UV index",
      icon: (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
        </>
      ),
      value: formatUv(weather.uv_index),
      unit: ` ${uvLabel(weather.uv_index)}`,
    },
    {
      label: "Visibility",
      icon: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
      value: visibilityKm(weather.visibility),
      unit: " km",
    },
    {
      label: "Cloud cover",
      icon: <path d={CLOUD_PATH} />,
      value: weather.cloud_cover != null ? `${weather.cloud_cover.toFixed()}` : "—",
      unit: "%",
    },
    {
      label: "Precip.",
      icon: <><path d="M6 14a6 6 0 0 1 12 0" /><path d="M12 18v3" /><path d="M8 19l-1 2" /><path d="M16 19l1 2" /></>,
      value: weather.precipitation != null ? weather.precipitation.toFixed(1) : "0.0",
      unit: " mm",
    },
    {
      label: "Dew point",
      icon: <><path d="M4 14h16" /><path d="M7 14a5 5 0 0 1 10 0" /><path d="M12 4v4" /><path d="m9 6 3-3 3 3" /></>,
      value: weather.dew_point != null ? formatTemperature(weather.dew_point, units) : "—",
    },
  ];
}

/** The hero's grid of current readings. */
export const HeroStats: React.FC<{ weather: WeatherData; units: Units }> = ({ weather, units }) => (
  <div className="stats">
    {stats(weather, units).map((s) => (
      <div className="stat" key={s.label}>
        <LineIcon className="icon">{s.icon}</LineIcon>
        <div className="info">
          <span className="label">{s.label}</span>
          <span className="value">
            {s.value}
            {s.unit !== undefined && <span className="u">{s.unit}</span>}
          </span>
        </div>
      </div>
    ))}
  </div>
);
