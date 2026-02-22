import React from "react";
import type { DebugOverrides } from "../weather-scene/types";
import type {
  WeatherEffectType,
  WeatherIntensity,
  TimeOfDayPhase,
} from "../weather-scene/weatherSceneLogic";
import "./DebugMenu.scss";

const EFFECT_OPTIONS: (WeatherEffectType | "auto")[] = [
  "auto",
  "clear",
  "rain",
  "snow",
  "fog",
  "thunderstorm",
];
const INTENSITY_OPTIONS: (WeatherIntensity | "auto")[] = [
  "auto",
  "light",
  "moderate",
  "heavy",
];
const TIME_OPTIONS: (TimeOfDayPhase | "auto")[] = [
  "auto",
  "night",
  "dawn",
  "day",
  "dusk",
];

export function isOverridesDirty(overrides: DebugOverrides | null): boolean {
  if (!overrides) return false;
  const o = overrides;
  return (
    (o.effectType !== undefined && o.effectType !== "auto") ||
    (o.intensity !== undefined && o.intensity !== "auto") ||
    (o.particleCount !== undefined && o.particleCount !== "auto") ||
    (o.fogDensity !== undefined && o.fogDensity !== "auto") ||
    (o.timeOfDay !== undefined && o.timeOfDay !== "auto") ||
    (o.windSpeed !== undefined && o.windSpeed !== "auto") ||
    (o.windDirection !== undefined && o.windDirection !== "auto") ||
    (o.parallaxAmount !== undefined && o.parallaxAmount !== "auto") ||
    (o.thunderstorm !== undefined && o.thunderstorm !== "auto")
  );
}

interface DebugMenuProps {
  open: boolean;
  onClose: () => void;
  overrides: DebugOverrides | null;
  onOverridesChange: (overrides: DebugOverrides | null) => void;
}

const DebugMenu: React.FC<DebugMenuProps> = ({
  open,
  onClose,
  overrides,
  onOverridesChange,
}) => {
  const o = overrides ?? {};

  const update = (next: DebugOverrides) => {
    onOverridesChange(next);
  };

  const set = <K extends keyof DebugOverrides>(
    key: K,
    value: DebugOverrides[K]
  ) => {
    update({ ...o, [key]: value });
  };

  const resetAll = () => {
    onOverridesChange(null);
  };

  if (!open) return null;

  return (
    <div className="debug-menu-backdrop" onClick={onClose} role="dialog" aria-label="Debug menu">
      <div
        className="debug-menu-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="debug-menu-header">
          <h2>Debug — Scene overrides</h2>
          <button type="button" className="debug-menu-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="debug-menu-body">
          <div className="debug-menu-group">
            <label>Effect type</label>
            <select
              value={o.effectType ?? "auto"}
              onChange={(e) =>
                set(
                  "effectType",
                  e.target.value as DebugOverrides["effectType"]
                )
              }
            >
              {EFFECT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="debug-menu-group">
            <label>Intensity</label>
            <select
              value={o.intensity ?? "auto"}
              onChange={(e) =>
                set("intensity", e.target.value as DebugOverrides["intensity"])
              }
            >
              {INTENSITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="debug-menu-group">
            <label>Particle count</label>
            <input
              type="text"
              placeholder="auto"
              value={
                o.particleCount === undefined || o.particleCount === "auto"
                  ? ""
                  : String(o.particleCount)
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                set("particleCount", v === "" ? "auto" : Number(v) || 0);
              }}
            />
          </div>
          <div className="debug-menu-group">
            <label>Fog density</label>
            <input
              type="text"
              placeholder="auto"
              value={
                o.fogDensity === undefined || o.fogDensity === "auto"
                  ? ""
                  : String(o.fogDensity)
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                set("fogDensity", v === "" ? "auto" : Number(v) || 0);
              }}
            />
          </div>
          <div className="debug-menu-group">
            <label>Time of day</label>
            <select
              value={o.timeOfDay ?? "auto"}
              onChange={(e) =>
                set(
                  "timeOfDay",
                  e.target.value as DebugOverrides["timeOfDay"]
                )
              }
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="debug-menu-group">
            <label>Wind speed</label>
            <input
              type="text"
              placeholder="auto"
              value={
                o.windSpeed === undefined || o.windSpeed === "auto"
                  ? ""
                  : String(o.windSpeed)
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                set("windSpeed", v === "" ? "auto" : Number(v) ?? 0);
              }}
            />
          </div>
          <div className="debug-menu-group">
            <label>Wind direction (°)</label>
            <input
              type="number"
              min={0}
              max={360}
              placeholder="auto"
              value={
                o.windDirection === undefined || o.windDirection === "auto"
                  ? ""
                  : String(o.windDirection)
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                set(
                  "windDirection",
                  v === "" ? "auto" : Number(v)
                );
              }}
            />
          </div>
          <div className="debug-menu-group">
            <label>Parallax amount (0–1)</label>
            <input
              type="text"
              placeholder="auto"
              value={
                o.parallaxAmount === undefined || o.parallaxAmount === "auto"
                  ? ""
                  : String(o.parallaxAmount)
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                set(
                  "parallaxAmount",
                  v === "" ? "auto" : Number(v)
                );
              }}
            />
          </div>
          <div className="debug-menu-group">
            <label>Thunderstorm flash</label>
            <select
              value={
                o.thunderstorm === undefined || o.thunderstorm === "auto"
                  ? "auto"
                  : o.thunderstorm
                  ? "on"
                  : "off"
              }
              onChange={(e) => {
                const v = e.target.value;
                set(
                  "thunderstorm",
                  v === "auto" ? "auto" : v === "on"
                );
              }}
            >
              <option value="auto">auto</option>
              <option value="on">on</option>
              <option value="off">off</option>
            </select>
          </div>
          <div className="debug-menu-actions">
            <button type="button" onClick={resetAll}>
              Reset all to auto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugMenu;
