import React, { useEffect } from "react";
import { VscClose } from "react-icons/vsc";
import { MdRestartAlt } from "react-icons/md";
import type { DebugOverrides, TimeOfDayPhase, SimulationConfig } from "../../weather/config";
import type { EffectType, Intensity } from "../../weather/codes";
import type { DebugBoxPosition } from "../../weather-scene/scene/DebugBox";
import { getTierForCover } from "../../weather-scene/effects/CloudEffect";
import "./DebugMenu.scss";

const DEBUG_BOX_STEP = 0.5;

const EFFECT_OPTIONS: (EffectType | "auto")[] = [
  "auto",
  "clear",
  "rain",
  "snow",
  "fog",
  "thunderstorm",
];
const INTENSITY_OPTIONS: (Intensity | "auto")[] = [
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
    (o.cloudCover !== undefined && o.cloudCover !== "auto") ||
    (o.windSpeed !== undefined && o.windSpeed !== "auto") ||
    (o.windDirection !== undefined && o.windDirection !== "auto") ||
    (o.parallaxAmount !== undefined && o.parallaxAmount !== "auto") ||
    (o.temperature !== undefined && o.temperature !== "auto") ||
    (o.humidity !== undefined && o.humidity !== "auto")
  );
}

interface DebugMenuProps {
  open: boolean;
  onClose: () => void;
  overrides: DebugOverrides | null;
  onOverridesChange: (overrides: DebugOverrides | null) => void;
  currentConfig: SimulationConfig | null;
  debugBoxPosition: DebugBoxPosition;
  onDebugBoxPositionChange: (pos: DebugBoxPosition) => void;
  freeCamera?: boolean;
}

function effective<T>(override: T | "auto" | undefined, current: T | undefined): T | undefined {
  if (override !== undefined && override !== "auto") return override as T;
  return current;
}

function numericOrAuto(v: string): number | "auto" {
  if (v === "") return "auto";
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : "auto";
}

const DebugMenu: React.FC<DebugMenuProps> = ({
  open,
  onClose,
  overrides,
  onOverridesChange,
  currentConfig,
  debugBoxPosition,
  onDebugBoxPositionChange,
  freeCamera = false,
}) => {
  const o = overrides ?? {};
  const c = currentConfig;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const step = DEBUG_BOX_STEP;
      const update = (delta: Partial<DebugBoxPosition>) => {
        onDebugBoxPositionChange({
          ...debugBoxPosition,
          ...delta,
        });
      };
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        update({ x: debugBoxPosition.x - step });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        update({ x: debugBoxPosition.x + step });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        update({ z: debugBoxPosition.z + step });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        update({ z: debugBoxPosition.z - step });
      } else if (e.key === "Control" && !e.repeat) {
        e.preventDefault();
        update({ y: debugBoxPosition.y + step });
      } else if (e.key === " ") {
        e.preventDefault();
        update({ y: debugBoxPosition.y - step });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, debugBoxPosition, onDebugBoxPositionChange]);

  const update = (next: DebugOverrides) => {
    onOverridesChange(next);
  };

  const set = <K extends keyof DebugOverrides>(
    key: K,
    value: DebugOverrides[K],
  ) => {
    update({ ...o, [key]: value });
  };

  const resetAll = () => {
    onOverridesChange(null);
  };

  if (!open) return null;

  return (
    <div
      className={`debug-menu-backdrop${freeCamera ? " debug-menu-backdrop--freecam" : ""}`}
      onClick={freeCamera ? undefined : onClose}
      role="dialog"
      aria-label="Debug menu"
    >
      <div className="debug-menu-panel" onClick={(e) => e.stopPropagation()}>
        <div className="debug-menu-header">
          <h2>Debug panel</h2>
          <div className="debug-menu-header-actions">
            <button type="button" className="debug-menu-icon-btn" onClick={resetAll} title="Reset all to auto">
              <MdRestartAlt />
            </button>
            <button type="button" className="debug-menu-icon-btn" onClick={onClose} title="Close">
              <VscClose />
            </button>
          </div>
        </div>
        <div className="debug-menu-body">
          <div className="debug-menu-group debug-menu-group--debug-box">
            <label>Debug box</label>
            <div className="debug-menu-debug-box-coords">
              x: {debugBoxPosition.x.toFixed(2)} · y:{" "}
              {debugBoxPosition.y.toFixed(2)} · z:{" "}
              {debugBoxPosition.z.toFixed(2)}
            </div>
            <div className="debug-menu-debug-box-keys">
              ← → X · ↑ ↓ Z · Ctrl Y+ · Space Y−
            </div>
            <p className="debug-menu-hint">Press <kbd>C</kbd> for free camera — WASD move, mouse orbit</p>
          </div>
          <div className="debug-menu-group">
            <label>Effect type {c && <span className="debug-menu-current">(current: {effective(o.effectType, c.effectType) ?? "—"})</span>}</label>
            <div className="debug-menu-button-group">
              {EFFECT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`debug-menu-option-btn ${(effective(o.effectType, c?.effectType) ?? "auto") === opt ? "debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("effectType", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-menu-group">
            <label>Intensity {c && <span className="debug-menu-current">(current: {effective(o.intensity, c.intensity) ?? "—"})</span>}</label>
            <div className="debug-menu-button-group">
              {INTENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`debug-menu-option-btn ${(effective(o.intensity, c?.intensity) ?? "auto") === opt ? "debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("intensity", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-menu-group">
            <label>Time of day {c && <span className="debug-menu-current">(current: {effective(o.timeOfDay, c.timeOfDay) ?? "—"})</span>}</label>
            <div className="debug-menu-button-group">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`debug-menu-option-btn ${(effective(o.timeOfDay, c?.timeOfDay) ?? "auto") === opt ? "debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("timeOfDay", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-menu-row">
            <div className="debug-menu-group debug-menu-group--half">
              <label>Wind speed {c != null && <span className="debug-menu-current">({c.windSpeed})</span>}</label>
              <input
                type="number"
                step={2}
                min={0}
                placeholder={c != null ? `auto (${c.windSpeed})` : "auto"}
                value={o.windSpeed === undefined || o.windSpeed === "auto" ? "" : String(o.windSpeed)}
                onChange={(e) => set("windSpeed", numericOrAuto(e.target.value.trim()))}
              />
            </div>
            <div className="debug-menu-group debug-menu-group--half">
              <label>Wind dir (°) {c != null && <span className="debug-menu-current">({c.windDirection})</span>}</label>
              <input
                type="number"
                step={5}
                min={0}
                max={360}
                placeholder={c != null ? `auto (${c.windDirection})` : "auto"}
                value={o.windDirection === undefined || o.windDirection === "auto" ? "" : String(o.windDirection)}
                onChange={(e) => set("windDirection", numericOrAuto(e.target.value.trim()))}
              />
            </div>
          </div>
          <div className="debug-menu-row">
            <div className="debug-menu-group debug-menu-group--half">
              <label>Cloud count {c != null && <span className="debug-menu-current">({getTierForCover(c.cloudCover).name}: {getTierForCover(c.cloudCover).count})</span>}</label>
              <input
                type="number"
                step={10}
                min={0}
                max={300}
                placeholder={c != null ? `auto (${getTierForCover(c.cloudCover).count})` : "auto"}
                value={o.cloudCount === undefined || o.cloudCount === "auto" ? "" : String(o.cloudCount)}
                onChange={(e) => set("cloudCount", numericOrAuto(e.target.value.trim()))}
              />
            </div>
            <div className="debug-menu-group debug-menu-group--half">
              <label>Cloud cover {c != null && <span className="debug-menu-current">({c.cloudCover})</span>}</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={1}
                placeholder={c != null ? `auto (${c.cloudCover})` : "auto"}
                value={o.cloudCover === undefined || o.cloudCover === "auto" ? "" : String(o.cloudCover)}
                onChange={(e) => set("cloudCover", numericOrAuto(e.target.value.trim()))}
              />
            </div>
          </div>
          <div className="debug-menu-row">
            <div className="debug-menu-group debug-menu-group--half">
              <label>Particles {c != null && <span className="debug-menu-current">({c.particleCount})</span>}</label>
              <input
                type="number"
                step={10}
                min={0}
                placeholder={c != null ? `auto (${c.particleCount})` : "auto"}
                value={o.particleCount === undefined || o.particleCount === "auto" ? "" : String(o.particleCount)}
                onChange={(e) => set("particleCount", numericOrAuto(e.target.value.trim()))}
              />
            </div>
            <div className="debug-menu-group debug-menu-group--half">
              <label>Fog density {c != null && <span className="debug-menu-current">({c.fogDensity.toFixed(3)})</span>}</label>
              <input
                type="number"
                step={0.1}
                min={0}
                placeholder={c != null ? `auto (${c.fogDensity.toFixed(3)})` : "auto"}
                value={o.fogDensity === undefined || o.fogDensity === "auto" ? "" : String(o.fogDensity)}
                onChange={(e) => set("fogDensity", numericOrAuto(e.target.value.trim()))}
              />
            </div>
          </div>
          <div className="debug-menu-row">
            <div className="debug-menu-group debug-menu-group--half">
              <label>Temp (°C) {c != null && c.temperature != null && <span className="debug-menu-current">({c.temperature})</span>}</label>
              <input
                type="number"
                step={5}
                placeholder={c != null && c.temperature != null ? `auto (${c.temperature})` : "auto"}
                value={o.temperature === undefined || o.temperature === "auto" ? "" : String(o.temperature)}
                onChange={(e) => set("temperature", numericOrAuto(e.target.value.trim()))}
              />
            </div>
            <div className="debug-menu-group debug-menu-group--half">
              <label>Humidity (%) {c != null && c.humidity != null && <span className="debug-menu-current">({c.humidity})</span>}</label>
              <input
                type="number"
                step={5}
                min={0}
                max={100}
                placeholder={c != null && c.humidity != null ? `auto (${c.humidity})` : "auto"}
                value={o.humidity === undefined || o.humidity === "auto" ? "" : String(o.humidity)}
                onChange={(e) => set("humidity", numericOrAuto(e.target.value.trim()))}
              />
            </div>
          </div>
          <div className="debug-menu-group">
            <label>Parallax (0–1) {c != null && <span className="debug-menu-current">({c.parallaxAmount})</span>}</label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              placeholder={c != null ? `auto (${c.parallaxAmount})` : "auto"}
              value={o.parallaxAmount === undefined || o.parallaxAmount === "auto" ? "" : String(o.parallaxAmount)}
              onChange={(e) => set("parallaxAmount", numericOrAuto(e.target.value.trim()))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugMenu;
