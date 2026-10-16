import { createContext, useContext } from "react";
import type { SceneOverrides } from "../../weather/overrides";
import type { SceneParams } from "../../weather/sceneParams";

/** A number for the readouts, trailing ".0" dropped. */
export const fmt = (v: number, digits = 1) => v.toFixed(digits).replace(/\.0+$/, "");

export function moonPhaseName(phase: number): string {
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

export type SetOverride = <K extends keyof SceneOverrides>(key: K, value: SceneOverrides[K]) => void;

/** What every debug field reads: the pins, how to change one, and the params with and without them. */
export interface DebugState {
  o: SceneOverrides;
  set: SetOverride;
  /** Weather-driven values (no overrides) — shown as the "auto" hint. */
  current: SceneParams;
  /** What the scene is actually rendering. */
  effective: SceneParams;
}

export const DebugContext = createContext<DebugState | null>(null);

export function useDebug(): DebugState {
  const state = useContext(DebugContext);
  if (!state) throw new Error("useDebug must be used inside the debug menu");
  return state;
}
