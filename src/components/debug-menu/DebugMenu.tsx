import React, { useEffect } from "react";
import type { DebugOverrides, TimeOfDayPhase } from "../../weather/config";
import type { EffectType, Intensity } from "../../weather/codes";
import type { DebugBoxPosition } from "../../weather-scene/scene/DebugBox";
import type { CloudSpawnBounds } from "../../weather-scene/scene/CloudSpawnDebugBox";
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
    (o.windSpeed !== undefined && o.windSpeed !== "auto") ||
    (o.windDirection !== undefined && o.windDirection !== "auto") ||
    (o.parallaxAmount !== undefined && o.parallaxAmount !== "auto") ||
    (o.thunderstorm !== undefined && o.thunderstorm !== "auto") ||
    (o.temperature !== undefined && o.temperature !== "auto") ||
    (o.humidity !== undefined && o.humidity !== "auto")
  );
}

interface DebugMenuProps {
  open: boolean;
  onClose: () => void;
  overrides: DebugOverrides | null;
  onOverridesChange: (overrides: DebugOverrides | null) => void;
  debugBoxPosition: DebugBoxPosition;
  onDebugBoxPositionChange: (pos: DebugBoxPosition) => void;
  cloudSpawnBounds: CloudSpawnBounds | null;
}

const DebugMenu: React.FC<DebugMenuProps> = ({
  open,
  onClose,
  overrides,
  onOverridesChange,
  debugBoxPosition,
  onDebugBoxPositionChange,
  cloudSpawnBounds,
}) => {
  const o = overrides ?? {};

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
      className="debug-menu-backdrop"
      onClick={onClose}
      role="dialog"
      aria-label="Debug menu"
    >
      <div className="debug-menu-panel" onClick={(e) => e.stopPropagation()}>
        <div className="debug-menu-header">
          <h2>Debug — Scene overrides</h2>
          <button type="button" className="debug-menu-close" onClick={onClose}>
            Close
          </button>
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
          </div>
          <div className="debug-menu-group debug-menu-group--cloud-spawn">
            <label>Cloud spawn (wireframe on scene)</label>
            <div className="debug-menu-cloud-spawn-dims">
              {cloudSpawnBounds ? (
                <>
                  width: {cloudSpawnBounds.width.toFixed(1)} · height:{" "}
                  {cloudSpawnBounds.height.toFixed(1)} · depth:{" "}
                  {cloudSpawnBounds.depth.toFixed(1)}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="debug-menu-group">
            <label>Effect type</label>
            <div className="debug-menu-button-group">
              {EFFECT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`debug-menu-option-btn ${(o.effectType ?? "auto") === opt ? "debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("effectType", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-menu-group">
            <label>Intensity</label>
            <div className="debug-menu-button-group">
              {INTENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`debug-menu-option-btn ${(o.intensity ?? "auto") === opt ? "debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("intensity", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-menu-group">
            <label>Time of day</label>
            <div className="debug-menu-button-group">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`debug-menu-option-btn ${(o.timeOfDay ?? "auto") === opt ? "debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("timeOfDay", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
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
                set("windSpeed", v === "" ? "auto" : (Number(v) ?? 0));
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
                set("windDirection", v === "" ? "auto" : Number(v));
              }}
            />
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
            <label>Temperature (°C)</label>
            <input
              type="text"
              placeholder="auto"
              value={
                o.temperature === undefined || o.temperature === "auto"
                  ? ""
                  : String(o.temperature)
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                set("temperature", v === "" ? "auto" : Number(v));
              }}
            />
          </div>
          <div className="debug-menu-group">
            <label>Humidity (%)</label>
            <input
              type="text"
              placeholder="auto"
              value={
                o.humidity === undefined || o.humidity === "auto"
                  ? ""
                  : String(o.humidity)
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                set("humidity", v === "" ? "auto" : Number(v));
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
                set("parallaxAmount", v === "" ? "auto" : Number(v));
              }}
            />
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
