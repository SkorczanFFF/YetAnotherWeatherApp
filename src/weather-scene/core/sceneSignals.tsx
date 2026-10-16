import { createContext, useContext } from "react";
import { Color, DataTexture, type Texture, Vector3 } from "three";

// Per-frame shared state. Written once per frame by <SceneDriver> (mounted
// right after the camera rig) — except `flash` / `flashPosition`, written by
// <Thunder>, and `cloudCover`, written by <VolumetricClouds> — and read by
// every layer inside its own useFrame.
// Plain mutable objects — never React state — so nothing re-renders at 60 fps.

export interface SceneSignals {
  /** Display directions (compressed into the frame), unit vectors. */
  sunDir: Vector3;
  moonDir: Vector3;
  /** Light directions for the cloud march: display azimuth, REAL altitude, unit vectors. */
  sunLightDir: Vector3;
  moonLightDir: Vector3;
  /** Real altitudes, radians… */
  sunAlt: number;
  moonAlt: number;
  /** …and degrees. */
  sunAltDeg: number;
  moonAltDeg: number;
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
  /** 0 with the sun ≥ 10° … 1 at or below the horizon: an overcast's dusk tint (night takes over after). */
  lowSun: number;
  /** 0..1 the REAL sun's / moon's disc above the horizon — the disc, its glow and its flare fade on it. */
  sunDisc: number;
  moonDisc: number;
  /** 0..1 how much of the frame low/mid cloud fills (UI backlight). */
  cloudFill: number;
  /** 0..1 horizon haze / fog strength (sky overlay). */
  haze: number;
  horizonColor: Color;
  sunColor: Color;
  /** sunColor sRGB-encoded, for layers that draw in display space (glow, flare, god rays). */
  sunColorDisplay: Color;
  moonIntensity: number;
  /** Sky / ground ambient colours (cloud ambient). */
  hemiSky: Color;
  hemiGround: Color;
  /** Gust-modulated surface wind, m/s, world space (y = 0). */
  windVelocity: Vector3;
  /** Wind at low/mid cloud level (850 hPa) and at cirrus level (300 hPa), m/s, world. */
  windVelocityLow: Vector3;
  windVelocityHigh: Vector3;
  /** Accumulated displacement of those air masses, metres. */
  windOffsetLow: Vector3;
  windOffsetHigh: Vector3;
  /** 0..~0.8 lightning flash envelope (Thunder: double-flash envelope × distance peak ≤ 1). */
  flash: number;
  /** World position of the current bolt (for lighting the right cloud), valid while flash > 0. */
  flashPosition: Vector3;
  /** This frame's resolved cloud target (a = cover over the screen); NO_CLOUD_COVER on the potato deck or a clear sky. */
  cloudCover: Texture;
}

/** Transparent 1×1 stand-in for the cloud target: nothing covers the screen. */
export const NO_CLOUD_COVER = new DataTexture(new Uint8Array(4), 1, 1);
NO_CLOUD_COVER.needsUpdate = true;

/** Placeholder values: <SceneDriver> overwrites them before any layer reads them. */
export function createSceneSignals(): SceneSignals {
  return {
    sunDir: new Vector3(0, 0, -1),
    moonDir: new Vector3(0, 0, -1),
    sunLightDir: new Vector3(0, 1, 0),
    moonLightDir: new Vector3(0, 1, 0),
    sunAlt: 0,
    moonAlt: 0,
    sunAltDeg: 0,
    moonAltDeg: 0,
    moonPhase: 0,
    moonFraction: 0,
    day: 0,
    night: 0,
    sunDisc: 0,
    moonDisc: 0,
    warmth: 0,
    overcast: 0,
    lowSun: 0,
    cloudFill: 0,
    haze: 0,
    horizonColor: new Color(),
    sunColor: new Color(),
    sunColorDisplay: new Color(),
    moonIntensity: 0,
    hemiSky: new Color(),
    hemiGround: new Color(),
    windVelocity: new Vector3(),
    windVelocityLow: new Vector3(),
    windVelocityHigh: new Vector3(),
    windOffsetLow: new Vector3(),
    windOffsetHigh: new Vector3(),
    flash: 0,
    flashPosition: new Vector3(),
    cloudCover: NO_CLOUD_COVER,
  };
}

const SignalsContext = createContext<SceneSignals | null>(null);

export const SceneSignalsProvider = SignalsContext.Provider;

export function useSceneSignals(): SceneSignals {
  const signals = useContext(SignalsContext);
  if (!signals) throw new Error("useSceneSignals must be used inside <SceneSignalsProvider>");
  return signals;
}
