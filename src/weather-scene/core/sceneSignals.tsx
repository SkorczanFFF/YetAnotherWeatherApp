import { createContext, useContext } from "react";
import { Color, Vector3 } from "three";
import type { Facing } from "./worldFrame";

// Per-frame shared state. Written once per frame by <SceneDriver> (mounted
// right after the camera rig), read by every layer inside its own useFrame.
// Plain mutable objects — never React state — so nothing re-renders at 60 fps.

export interface SceneSignals {
  /** Scene instant, unix ms. */
  time: number;
  facing: Facing;
  /** Display directions (compressed into the frame), unit vectors. */
  sunDir: Vector3;
  moonDir: Vector3;
  /** Real altitudes, radians. */
  sunAlt: number;
  moonAlt: number;
  /** suncalc: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  moonPhase: number;
  moonFraction: number;
  /** 0..1 direct sunlight. */
  day: number;
  /** 0..1, 1 = full night. */
  night: number;
  /** 0..1, peaks with the sun near the horizon. */
  warmth: number;
  /** 0..1 how much the cloud deck hides the sky. */
  overcast: number;
  /** 0..1 horizon haze / fog strength (sky overlay). */
  haze: number;
  fogDensity: number;
  horizonColor: Color;
  sunColor: Color;
  sunIntensity: number;
  moonIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  /** Gust-modulated wind, m/s, world space (y = 0). */
  windVelocity: Vector3;
  /** Accumulated air displacement, metres (y = 0). */
  windOffset: Vector3;
  /** 0..~1.5 lightning flash envelope. */
  flash: number;
  /** World position of the current bolt (for lighting the right cloud), valid while flash > 0. */
  flashPosition: Vector3;
}

export function createSceneSignals(): SceneSignals {
  return {
    time: Date.now(),
    facing: "south",
    sunDir: new Vector3(0, 0.3, -1).normalize(),
    moonDir: new Vector3(0, 0.3, -1).normalize(),
    sunAlt: 0.5,
    moonAlt: -0.5,
    moonPhase: 0.5,
    moonFraction: 1,
    day: 1,
    night: 0,
    warmth: 0,
    overcast: 0,
    haze: 0,
    fogDensity: 0.001,
    horizonColor: new Color("#c8d8e6"),
    sunColor: new Color("#fff3df"),
    sunIntensity: 2,
    moonIntensity: 0,
    hemiSky: new Color("#a9c6e8"),
    hemiGround: new Color("#5b5a55"),
    hemiIntensity: 1,
    windVelocity: new Vector3(),
    windOffset: new Vector3(),
    flash: 0,
    flashPosition: new Vector3(0, 40, -200),
  };
}

const SignalsContext = createContext<SceneSignals | null>(null);

export const SceneSignalsProvider = SignalsContext.Provider;

export function useSceneSignals(): SceneSignals {
  const signals = useContext(SignalsContext);
  if (!signals) throw new Error("useSceneSignals must be used inside <SceneSignalsProvider>");
  return signals;
}
