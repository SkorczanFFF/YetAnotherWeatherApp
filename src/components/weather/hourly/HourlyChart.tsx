import React, { useId, useMemo } from "react";
import { HourlyForecast, Units } from "../../../weather/types";
import { formatDegrees, formatToLocalTime, tempSymbol } from "../../../utils/format";
import "./HourlyChart.scss";

interface HourlyChartProps {
  hourly: HourlyForecast[];
  timezone: string;
  units: Units;
}

const W = 600;
const H = 140;
const PAD_L = 12;
const PAD_R = 12;
const PAD_T = 26;
const PAD_B = 28;
const POINTS = 12;

export const HourlyChart: React.FC<HourlyChartProps> = ({ hourly, timezone, units }) => {
  const gradientId = `temp-grad${useId()}`;
  const slice = useMemo(() => {
    const nowSec = Date.now() / 1000;
    let startIdx = hourly.findIndex((h) => h.time >= nowSec);
    if (startIdx < 0) startIdx = 0;
    return hourly.slice(startIdx, startIdx + POINTS);
  }, [hourly]);

  const chart = useMemo(() => {
    if (slice.length < 2) return null;
    const temps = slice.map((p) => p.temp);
    const min = Math.min(...temps) - 2;
    const max = Math.max(...temps) + 2;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const xs = (i: number) => PAD_L + (i / (slice.length - 1)) * innerW;
    const ys = (t: number) => PAD_T + (1 - (t - min) / (max - min || 1)) * innerH;

    const linePath = slice
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(p.temp).toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L ${W - PAD_R} ${PAD_T + innerH} L ${PAD_L} ${PAD_T + innerH} Z`;

    const grid = Array.from({ length: 4 }, (_, i) => PAD_T + (i / 3) * innerH);

    // Points and hour labels are an HTML overlay positioned in %, so the SVG's
    // preserveAspectRatio="none" doesn't stretch them horizontally.
    const points = slice.map((p, i) => ({
      key: i,
      time: p.time,
      temp: p.temp,
      xPct: (xs(i) / W) * 100,
      yPct: (ys(p.temp) / H) * 100,
    }));

    return { linePath, areaPath, grid, points };
  }, [slice]);

  if (!chart) return null;

  return (
    <section className="hourly">
      <div className="section-head">
        <span className="section-title">Next {POINTS} hours</span>
        <span className="section-hint">Temperature · {tempSymbol(units)}</span>
      </div>
      <div className="chart">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--accent-warm)" }} stopOpacity="0.38" />
              <stop offset="100%" style={{ stopColor: "var(--accent-warm)" }} stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.grid.map((y, i) => (
            <line
              key={i}
              className="grid-line"
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
            />
          ))}
          <path className="area" d={chart.areaPath} fill={`url(#${gradientId})`} />
          <path className="line" d={chart.linePath} />
        </svg>
        <div className="chart-overlay">
          {chart.points.map((p) =>
            p.key % 2 === 0 ? (
              <div
                key={`pt-${p.key}`}
                className="chart-pt"
                style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
              >
                <span className="chart-pt-label">
                  {formatDegrees(p.temp)}
                </span>
                <span className="chart-dot" />
              </div>
            ) : null,
          )}
          {chart.points.map((p) => (
            <span
              key={`hr-${p.key}`}
              className="chart-hr"
              style={{ left: `${p.xPct}%` }}
            >
              {formatToLocalTime(p.time, timezone, "HH")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
