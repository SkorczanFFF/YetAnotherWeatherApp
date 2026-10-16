import { createContext, useContext } from "react";
import type { SceneOverrides } from "../../weather/overrides";
import type { SceneParams } from "../../weather/sceneParams";
import { type Facing, windVelocity } from "../../weather-scene/core/worldFrame";

/** Which way a wind from `fromDeg` drifts the clouds on screen, e.g. "leftwards + away to the horizon". */
export function describeScreenDrift(fromDeg: number, facing: Facing): string {
  const v = windVelocity(fromDeg, 1, facing);
  const parts: string[] = [];
  if (v.x < -0.38) parts.push("leftwards");
  else if (v.x > 0.38) parts.push("rightwards");
  if (v.z < -0.38) parts.push("away to the horizon");
  else if (v.z > 0.38) parts.push("towards the viewer");
  return parts.join(" + ") || "—";
}

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

type SetOverride = <K extends keyof SceneOverrides>(key: K, value: SceneOverrides[K]) => void;

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
