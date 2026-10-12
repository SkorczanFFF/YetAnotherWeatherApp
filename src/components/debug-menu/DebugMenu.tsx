import React, { useEffect, useState } from "react";
import { VscClose } from "react-icons/vsc";
import { MdRestartAlt } from "react-icons/md";
import * as SunCalc from "suncalc";
import { DateTime } from "luxon";
import {
  type Auto,
  type QualityTier,
  type SceneOverrides,
  type SceneParams,
  getFrostAmount,
  getSunAltitude,
} from "../../weather/sceneParams";
import { WEATHER_PRESETS } from "../../weather/scenePresets";
import { describeScreenDrift, facingFor } from "../../weather-scene/core/worldFrame";
import { perfStats } from "../../weather-scene/debug/perfStats";
import type { CloudEngine } from "../../weather-scene/WeatherScene";
import { toCardinal } from "../../services/weatherFormatter";
import "./DebugMenu.scss";

export interface DebugTools {
  showVolumes: boolean;
  showPerf: boolean;
  /** TEST ONLY: our volumetric clouds vs @takram/three-clouds. */
  cloudEngine: CloudEngine;
}

const CLOUD_ENGINES: { id: CloudEngine; label: string }[] = [
  { id: "ours", label: "ours" },
  { id: "takram", label: "takram (test)" },
];

interface DebugMenuProps {
  open: boolean;
  onClose: () => void;
  overrides: SceneOverrides | null;
  onOverridesChange: (overrides: SceneOverrides | null) => void;
  /** Weather-driven values (no overrides) — shown as the "auto" hint. */
  currentParams: SceneParams;
  /** What the scene is actually rendering. */
  effectiveParams: SceneParams;
  tools: DebugTools;
  onToolsChange: (tools: DebugTools) => void;
  onForceLightning: () => void;
  freeCamera?: boolean;
}

const COMPASS = [0, 45, 90, 135, 180, 225, 270, 315];
const QUALITY_OPTIONS: Auto<QualityTier>[] = ["auto", "potato", "low", "medium", "high"];
/** Keys a preset owns — "Auto" preset clears exactly these. */
const PRESET_KEYS = Object.keys(WEATHER_PRESETS[0].overrides) as (keyof SceneOverrides)[];

type BoolKey = "drizzle" | "freezing" | "showers" | "hail" | "grains" | "thunder" | "rime";

function numericOrAuto(v: string): number | "auto" {
  if (v === "") return "auto";
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : "auto";
}

const fmt = (v: number, digits = 1) => v.toFixed(digits).replace(/\.0+$/, "");

function moonPhaseName(phase: number): string {
  const names = [
    "new",
    "waxing crescent",
    "first quarter",
    "waxing gibbous",
    "full",
    "waning gibbous",
    "last quarter",
    "waning crescent",
  ];
  return names[Math.round(phase * 8) % 8];
}

interface NumericFieldProps {
  label: string;
  field: keyof SceneOverrides;
  step: number;
  min?: number;
  max?: number;
  current: string;
  half?: boolean;
  overrides: SceneOverrides;
  onSet: <K extends keyof SceneOverrides>(key: K, value: SceneOverrides[K]) => void;
}

function NumericField({ label, field, step, min, max, current, half = true, overrides, onSet }: NumericFieldProps) {
  const raw = overrides[field];
  const display = raw === undefined || raw === "auto" ? "" : String(raw);
  return (
    <div className={`debug-menu-group${half ? " debug-menu-group--half" : ""}`}>
      <label>
        {label} <span className="debug-menu-current">({current})</span>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          placeholder={`auto (${current})`}
          value={display}
          onChange={(e) => onSet(field, numericOrAuto(e.target.value.trim()) as never)}
        />
      </label>
    </div>
  );
}

interface FlagChipProps {
  label: string;
  field: BoolKey;
  effective: boolean;
  overrides: SceneOverrides;
  onSet: <K extends keyof SceneOverrides>(key: K, value: SceneOverrides[K]) => void;
}

/** Tri-state chip: auto → on → off → auto. */
function FlagChip({ label, field, effective, overrides, onSet }: FlagChipProps) {
  const raw = overrides[field];
  const state = raw === undefined || raw === "auto" ? "auto" : raw ? "on" : "off";
  const next = state === "auto" ? true : state === "on" ? false : "auto";
  return (
    <button
      type="button"
      className={`debug-menu-option-btn${state !== "auto" ? " debug-menu-option-btn--active" : ""}`}
      onClick={() => onSet(field, next)}
      title="auto → on → off"
    >
      {label}: {state === "auto" ? `auto (${effective ? "on" : "off"})` : state}
    </button>
  );
}

function PerfReadout() {
  const [stats, setStats] = useState({ ...perfStats });
  useEffect(() => {
    const id = window.setInterval(() => setStats({ ...perfStats }), 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="debug-menu-readout">
      {stats.fps} fps · {stats.calls} draws · {stats.triangles} tris · {stats.points} pts · tier {stats.tier}
    </div>
  );
}

const DebugMenu: React.FC<DebugMenuProps> = ({
  open,
  onClose,
  overrides,
  onOverridesChange,
  currentParams: c,
  effectiveParams: e,
  tools,
  onToolsChange,
  onForceLightning,
  freeCamera = false,
}) => {
  const o = overrides ?? {};
  const [activePreset, setActivePreset] = useState<string | null>(null);

  if (!open) return null;

  const set = <K extends keyof SceneOverrides>(key: K, value: SceneOverrides[K]) => {
    onOverridesChange({ ...o, [key]: value });
  };

  const applyPreset = (id: string | null) => {
    setActivePreset(id);
    const cleared: SceneOverrides = { ...o };
    PRESET_KEYS.forEach((k) => delete cleared[k]);
    const preset = WEATHER_PRESETS.find((p) => p.id === id);
    onOverridesChange(preset ? { ...cleared, ...preset.overrides } : cleared);
  };

  const resetAll = () => {
    setActivePreset(null);
    onOverridesChange(null);
  };

  const time = e.time ?? Date.now();
  const sunAlt = (getSunAltitude(time, e.lat, e.lon) * 180) / Math.PI;
  const moon = SunCalc.getMoonIllumination(new Date(time));
  const facing = facingFor(e.lat);
  const hourValue = typeof o.hour === "number" ? o.hour : null;
  const local = DateTime.fromMillis(time).setZone(e.timezone);
  const liveHour = local.hour + local.minute / 60;

  return (
    <div
      className={`debug-menu-backdrop${freeCamera ? " debug-menu-backdrop--freecam" : ""}`}
      onClick={freeCamera ? undefined : onClose}
      role="dialog"
      aria-label="Debug menu"
    >
      <div className="debug-menu-panel" onClick={(ev) => ev.stopPropagation()}>
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
          <div className="debug-menu-group">
            <label>Weather preset</label>
            <div className="debug-menu-button-group">
              <button
                type="button"
                className={`debug-menu-option-btn${activePreset === null ? " debug-menu-option-btn--active" : ""}`}
                onClick={() => applyPreset(null)}
              >
                auto
              </button>
              {WEATHER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`debug-menu-option-btn${activePreset === p.id ? " debug-menu-option-btn--active" : ""}`}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-menu-group">
            <label>
              Local hour{" "}
              <span className="debug-menu-current">
                ({hourValue === null ? "live" : "pinned"} {local.toFormat("HH:mm")})
              </span>
            </label>
            <div className="debug-menu-row">
              <input
                type="range"
                min={0}
                max={24}
                step={0.25}
                value={hourValue ?? liveHour}
                onChange={(ev) => set("hour", parseFloat(ev.target.value))}
              />
              <button type="button" className={`debug-menu-option-btn${hourValue === null ? " debug-menu-option-btn--active" : ""}`} onClick={() => set("hour", "auto")}>
                live
              </button>
            </div>
          </div>
          <div className="debug-menu-row">
            <div className="debug-menu-group debug-menu-group--half">
              <label>
                Date
                <input
                  type="text"
                  placeholder="auto (today) YYYY-MM-DD"
                  value={typeof o.date === "string" && o.date !== "auto" ? o.date : ""}
                  onChange={(ev) => set("date", ev.target.value.trim() === "" ? "auto" : ev.target.value.trim())}
                />
              </label>
            </div>
            <div className="debug-menu-group debug-menu-group--half">
              <label>Sky</label>
              <div className="debug-menu-readout">
                sun {fmt(sunAlt)}° · moon {moonPhaseName(moon.phase)} {Math.round(moon.fraction * 100)}%
              </div>
            </div>
          </div>

          <div className="debug-menu-row">
            <NumericField label="Cloud low" field="cloudLow" step={0.05} min={0} max={1} current={fmt(c.clouds.low, 2)} overrides={o} onSet={set} />
            <NumericField label="mid" field="cloudMid" step={0.05} min={0} max={1} current={fmt(c.clouds.mid, 2)} overrides={o} onSet={set} />
            <NumericField label="high" field="cloudHigh" step={0.05} min={0} max={1} current={fmt(c.clouds.high, 2)} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-row">
            <NumericField label="Base m" field="cloudBase" step={100} min={0} current={fmt(c.cloudPhysics.baseM, 0)} overrides={o} onSet={set} />
            <NumericField label="Top m" field="cloudTop" step={250} min={0} current={fmt(c.cloudPhysics.topM, 0)} overrides={o} onSet={set} />
            <NumericField label="CAPE J/kg" field="cape" step={100} min={0} current={fmt(c.cloudPhysics.cape, 0)} overrides={o} onSet={set} />
            <NumericField label="τ" field="opticalDepth" step={2} min={0} current={fmt(c.cloudPhysics.opticalDepth)} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-group">
            <div className="debug-menu-readout">
              clouds {fmt(e.cloudPhysics.baseM, 0)}–{fmt(e.cloudPhysics.topM, 0)} m · τ {fmt(e.cloudPhysics.opticalDepth)}
              {e.cloudPhysics.opticalDepthMeasured ? " (radiation)" : " (estimated)"} · convection {Math.round(e.cloudPhysics.convection * 100)}%
              {e.cloudPhysics.liftedIndex != null && ` · LI ${fmt(e.cloudPhysics.liftedIndex)}`}
              {e.cloudPhysics.boundaryLayerM != null && ` · BL ${fmt(e.cloudPhysics.boundaryLayerM, 0)} m`}
              {e.cloudPhysics.freezingLevelM != null && ` · 0 °C at ${fmt(e.cloudPhysics.freezingLevelM, 0)} m`}
              {e.cloudPhysics.directFraction != null && ` · sun through clouds ${Math.round(e.cloudPhysics.directFraction * 100)}%`}
              {` · frost ${Math.round(getFrostAmount(e) * 100)}%`}
            </div>
          </div>

          <div className="debug-menu-row">
            <NumericField label="Wind m/s" field="windSpeed" step={1} min={0} current={fmt(c.wind.speedMs)} overrides={o} onSet={set} />
            <NumericField label="Gust m/s" field="windGust" step={1} min={0} current={fmt(c.wind.gustMs)} overrides={o} onSet={set} />
            <NumericField label="From °" field="windFrom" step={15} min={0} max={360} current={`${Math.round(c.wind.fromDeg)} ${toCardinal(c.wind.fromDeg)}`} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-group">
            <div className="debug-menu-button-group">
              {COMPASS.map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className={`debug-menu-option-btn${o.windFrom === deg ? " debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("windFrom", deg)}
                >
                  {toCardinal(deg)}
                </button>
              ))}
            </div>
            <div className="debug-menu-readout">
              surface from {toCardinal(e.wind.fromDeg)} · 850 hPa {fmt(e.cloudPhysics.windLow.speedMs)} m/s from {toCardinal(e.cloudPhysics.windLow.fromDeg)} → clouds drift {describeScreenDrift(e.cloudPhysics.windLow.fromDeg, facing)} · 300 hPa (cirrus) {fmt(e.cloudPhysics.windHigh.speedMs)} m/s from {toCardinal(e.cloudPhysics.windHigh.fromDeg)} (facing {facing})
            </div>
          </div>

          <div className="debug-menu-row">
            <NumericField label="Rain mm/h" field="rain" step={0.5} min={0} current={fmt(c.precip.rainMmH)} overrides={o} onSet={set} />
            <NumericField label="Snow cm/h" field="snow" step={0.25} min={0} current={fmt(c.precip.snowCmH, 2)} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-group">
            <div className="debug-menu-button-group">
              <FlagChip label="drizzle" field="drizzle" effective={e.precip.drizzle} overrides={o} onSet={set} />
              <FlagChip label="freezing" field="freezing" effective={e.precip.freezing} overrides={o} onSet={set} />
              <FlagChip label="showers" field="showers" effective={e.precip.showers} overrides={o} onSet={set} />
              <FlagChip label="hail" field="hail" effective={e.precip.hail} overrides={o} onSet={set} />
              <FlagChip label="grains" field="grains" effective={e.precip.grains} overrides={o} onSet={set} />
              <FlagChip label="thunder" field="thunder" effective={e.thunder} overrides={o} onSet={set} />
              <button type="button" className="debug-menu-option-btn" onClick={onForceLightning}>
                ⚡ force lightning
              </button>
            </div>
          </div>

          <div className="debug-menu-row">
            <NumericField label="Visibility m" field="visibility" step={100} min={50} current={fmt(c.fog.visibilityM, 0)} overrides={o} onSet={set} />
            <NumericField label="Temp °C" field="temperature" step={1} current={fmt(c.temperatureC)} overrides={o} onSet={set} />
            <NumericField label="Humidity" field="humidity" step={0.05} min={0} max={1} current={fmt(c.humidity, 2)} overrides={o} onSet={set} />
          </div>
          <div className="debug-menu-row">
            <NumericField label="Parallax 0–1" field="parallax" step={0.05} min={0} max={1} current={fmt(c.parallaxAmount, 2)} overrides={o} onSet={set} />
            <div className="debug-menu-group debug-menu-group--half">
              <label>Rime</label>
              <div className="debug-menu-button-group">
                <FlagChip label="rime" field="rime" effective={e.fog.rime} overrides={o} onSet={set} />
              </div>
            </div>
          </div>

          <div className="debug-menu-group">
            <label>Quality tier</label>
            <div className="debug-menu-button-group">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`debug-menu-option-btn${(o.quality ?? "auto") === q ? " debug-menu-option-btn--active" : ""}`}
                  onClick={() => set("quality", q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-menu-group">
            <label>Cloud renderer</label>
            <div className="debug-menu-button-group">
              {CLOUD_ENGINES.map((engine) => (
                <button
                  key={engine.id}
                  type="button"
                  className={`debug-menu-option-btn${tools.cloudEngine === engine.id ? " debug-menu-option-btn--active" : ""}`}
                  onClick={() => onToolsChange({ ...tools, cloudEngine: engine.id })}
                >
                  {engine.label}
                </button>
              ))}
            </div>
            <p className="debug-menu-readout">takram loads ~9 MB of atmosphere/noise data on first use.</p>
          </div>

          <div className="debug-menu-group">
            <label>Tools</label>
            <div className="debug-menu-button-group">
              <button
                type="button"
                className={`debug-menu-option-btn${tools.showVolumes ? " debug-menu-option-btn--active" : ""}`}
                onClick={() => onToolsChange({ ...tools, showVolumes: !tools.showVolumes })}
              >
                spawn volumes
              </button>
              <button
                type="button"
                className={`debug-menu-option-btn${tools.showPerf ? " debug-menu-option-btn--active" : ""}`}
                onClick={() => onToolsChange({ ...tools, showPerf: !tools.showPerf })}
              >
                perf
              </button>
            </div>
            {tools.showPerf && <PerfReadout />}
            <p className="debug-menu-readout">
              <kbd>C</kbd> free camera — WASD move, mouse orbit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugMenu;
