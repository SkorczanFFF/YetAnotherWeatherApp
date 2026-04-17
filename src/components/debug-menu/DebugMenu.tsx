import React, { useEffect } from "react";
import { VscClose } from "react-icons/vsc";
import { MdRestartAlt } from "react-icons/md";
import type { DebugOverrides } from "../../weather/config";
import type { EffectType, Intensity, TimeOfDay, SimulationConfig } from "../../weather/types";
import type { DebugBoxPosition } from "../../weather-scene/scene/DebugBox";
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
const TIME_OPTIONS: (TimeOfDay | "auto")[] = [
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
    (o.humidity !== undefined && o.humidity !== "auto") ||
    (o.cloudOpacity !== undefined && o.cloudOpacity !== "auto") ||
    (o.cloudColor !== undefined && o.cloudColor !== "auto")
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

interface DebugNumericFieldProps {
  label: string;
  field: keyof DebugOverrides;
  step: number;
  min?: number;
  max?: number;
  currentDisplay?: string | null;
  placeholder?: string;
  half?: boolean;
  overrides: DebugOverrides;
  onSet: <K extends keyof DebugOverrides>(key: K, value: DebugOverrides[K]) => void;
}

function DebugNumericField({ label, field, step, min, max, currentDisplay, placeholder, half = true, overrides, onSet }: DebugNumericFieldProps) {
  const raw = overrides[field];
  const display = raw === undefined || raw === "auto" ? "" : String(raw);
  const ph = placeholder ?? (currentDisplay != null ? `auto (${currentDisplay})` : "auto");
  return (
    <div className={`debug-menu-group${half ? " debug-menu-group--half" : ""}`}>
      <label>
        {label} {currentDisplay != null && <span className="debug-menu-current">({currentDisplay})</span>}
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          placeholder={ph}
          value={display}
          onChange={(e) => onSet(field, numericOrAuto(e.target.value.trim()))}
        />
      </label>
    </div>
  );
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
      const target = e.target as HTMLElement;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
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
            <button type="button" className="debug-menu-icon-btn" onClick={resetAll} title="Reset all to auto" aria-label="Reset all to auto">
              <MdRestartAlt />
            </button>
            <button type="button" className="debug-menu-icon-btn" onClick={onClose} title="Close" aria-label="Close debug menu">
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
            <DebugNumericField label="Wind speed" field="windSpeed" step={2} min={0} currentDisplay={c != null ? String(c.windSpeed) : null} overrides={o} onSet={set} />
            <DebugNumericField label="Wind dir (°)" field="windDirection" step={5} min={0} max={360} currentDisplay={c != null ? String(c.windDirection) : null} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-row">
            <DebugNumericField label="Cloud count" field="cloudCount" step={10} min={0} max={400} currentDisplay={c != null ? `cover ${c.cloudCover.toFixed(2)}` : null} overrides={o} onSet={set} />
            <DebugNumericField label="Cloud cover" field="cloudCover" step={0.05} min={0} max={1} currentDisplay={c != null ? String(c.cloudCover) : null} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-row">
            <DebugNumericField label="Cloud opacity" field="cloudOpacity" step={0.05} min={0} max={1} currentDisplay={c != null ? "auto" : null} overrides={o} onSet={set} />
            <DebugNumericField label="Cloud color" field="cloudColor" step={0.05} min={0} max={1} currentDisplay={c != null ? "auto" : null} placeholder="auto (0=white, 1=gray)" overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-row">
            <DebugNumericField label="Particles" field="particleCount" step={10} min={0} currentDisplay={c != null ? String(c.particleCount) : null} overrides={o} onSet={set} />
            <DebugNumericField label="Fog density" field="fogDensity" step={0.1} min={0} currentDisplay={c != null ? c.fogDensity.toFixed(3) : null} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-row">
            <DebugNumericField label="Temp (°C)" field="temperature" step={5} currentDisplay={c?.temperature != null ? String(c.temperature) : null} overrides={o} onSet={set} />
            <DebugNumericField label="Humidity (%)" field="humidity" step={5} min={0} max={100} currentDisplay={c?.humidity != null ? String(c.humidity) : null} overrides={o} onSet={set} />
          </div>
          <DebugNumericField label="Parallax (0–1)" field="parallaxAmount" step={0.05} min={0} max={1} half={false} currentDisplay={c != null ? String(c.parallaxAmount) : null} overrides={o} onSet={set} />
        </div>
      </div>
    </div>
  );
};

export default DebugMenu;
