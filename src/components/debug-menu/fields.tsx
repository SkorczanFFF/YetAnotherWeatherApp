import React, { useEffect, useState } from "react";
import type { BoolOverrideKey, SceneOverrides } from "../../weather/overrides";
import { perfStats } from "../../weather-scene/debug/perfStats";
import { useDebug } from "./helpers";

interface OptionButtonProps {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}

export function OptionButton({ active = false, onClick, title, children }: OptionButtonProps) {
  return (
    <button
      type="button"
      className={`debug-menu-option-btn${active ? " debug-menu-option-btn--active" : ""}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function numericOrAuto(v: string): number | "auto" {
  if (v === "") return "auto";
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : "auto";
}

interface NumericFieldProps {
  label: string;
  field: keyof SceneOverrides;
  step: number;
  min?: number;
  max?: number;
  /** The auto value, shown as a hint. */
  current: string;
}

export function NumericField({ label, field, step, min, max, current }: NumericFieldProps) {
  const { o, set } = useDebug();
  const raw = o[field];
  const display = raw === undefined || raw === "auto" ? "" : String(raw);
  return (
    <div className="debug-menu-group debug-menu-group--half">
      <label>
        {label} <span className="debug-menu-current">({current})</span>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          placeholder={`auto (${current})`}
          value={display}
          onChange={(e) => set(field, numericOrAuto(e.target.value.trim()) as never)}
        />
      </label>
    </div>
  );
}

interface FlagChipProps {
  label: string;
  field: BoolOverrideKey;
  /** The value in effect, shown while auto. */
  effective: boolean;
}

/** Tri-state chip: auto → on → off → auto. */
export function FlagChip({ label, field, effective }: FlagChipProps) {
  const { o, set } = useDebug();
  const raw = o[field];
  const state = raw === undefined || raw === "auto" ? "auto" : raw ? "on" : "off";
  const next = state === "auto" ? true : state === "on" ? false : "auto";
  return (
    <OptionButton active={state !== "auto"} onClick={() => set(field, next)} title="auto → on → off">
      {label}: {state === "auto" ? `auto (${effective ? "on" : "off"})` : state}
    </OptionButton>
  );
}

export function PerfReadout() {
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
