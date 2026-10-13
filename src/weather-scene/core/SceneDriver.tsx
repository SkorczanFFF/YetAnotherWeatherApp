import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, MathUtils } from "three";
import * as SunCalc from "suncalc";
import type { SceneParams } from "../../weather/sceneParams";
import { useSceneSignals } from "./sceneSignals";
import type { ViewFrame } from "./viewVolume";
import {
  directionFromRelative,
  facingFor,
  METRES_PER_UNIT,
  MIN_DRIFT_MS,
  relativeAzimuth,
  windVelocity,
} from "./worldFrame";

interface SceneDriverProps {
  params: SceneParams;
  frame: ViewFrame;
}

/** Celestial bodies move slowly — recompute suncalc at most this often (ms). */
const CELESTIAL_INTERVAL = 1000;
/** Any azimuth up to ±135° from straight ahead is squeezed into 80 % of the half-frame. */
const AZ_SQUEEZE_RANGE = 135 * MathUtils.DEG2RAD;

// Palette (sRGB hex → linear via Color).
const DAY_HAZE = new Color("#c8d8e6");
const TWILIGHT = new Color("#eda476");
const NIGHT_HAZE = new Color("#141c30");
const OVERCAST_DAY = new Color("#a3abb5");
const OVERCAST_NIGHT = new Color("#1b1f28");
const RIME_FOG = new Color("#e2e8ef");
const HEAT_HAZE = new Color("#dccdb0");
const SUN_LOW = new Color("#ff8f4d");
const SUN_HIGH = new Color("#fff3df");
const HEMI_DAY = new Color("#a9c6e8");
const HEMI_NIGHT = new Color("#1c2740");
const HEMI_OVERCAST = new Color("#8f98a3");
const GROUND_DAY = new Color("#5b5a55");
const GROUND_NIGHT = new Color("#0d1018");

const smoothstep = MathUtils.smoothstep;

/** Smooth pseudo-random gust envelope, 0..1, mostly near 0 with occasional peaks. */
function gustEnvelope(t: number): number {
  const n =
    (Math.sin(t * 0.37) + Math.sin(t * 0.71 + 1.3) + Math.sin(t * 1.13 + 2.1)) /
    3;
  return Math.pow(Math.max(0, n), 1.5) * 2.2;
}

/**
 * Writes the per-frame SceneSignals: clock, sun/moon (real + display
 * direction), light/fog colours, gust-modulated wind. Mount after the camera
 * rig and before every layer — R3F runs useFrame callbacks in mount order.
 */
export function SceneDriver({ params, frame }: SceneDriverProps) {
  const s = useSceneSignals();
  const lastCelestial = useRef(-Infinity);
  const lastParams = useRef<SceneParams | null>(null);
  const lastFrame = useRef<ViewFrame | null>(null);
  const sunAz = useRef(0);
  const moonAz = useRef(0);
  const scratch = useRef(new Color());

  useFrame((state, delta) => {
    const time = params.time ?? Date.now();
    const facing = facingFor(params.lat);

    // --- celestial (throttled; params/frame changes force a recompute) ---
    if (
      params !== lastParams.current ||
      frame !== lastFrame.current ||
      time - lastCelestial.current > CELESTIAL_INTERVAL
    ) {
      lastParams.current = params;
      lastFrame.current = frame;
      lastCelestial.current = time;
      const date = new Date(time);
      const sun = SunCalc.getPosition(date, params.lat, params.lon);
      const moon = SunCalc.getMoonPosition(date, params.lat, params.lon);
      const illum = SunCalc.getMoonIllumination(date);
      s.sunAlt = sun.altitude;
      s.moonAlt = moon.altitude;
      sunAz.current = sun.azimuth;
      moonAz.current = moon.azimuth;
      s.moonPhase = illum.phase;
      s.moonFraction = illum.fraction;
    }
    const kAz = Math.min(1, (0.8 * frame.hHalfRaw) / AZ_SQUEEZE_RANGE);
    const kAlt = (frame.topElevRaw - 5 * MathUtils.DEG2RAD) / (Math.PI / 2);
    directionFromRelative(
      relativeAzimuth(sunAz.current, facing) * kAz,
      s.sunAlt * kAlt,
      s.sunDir,
    );
    directionFromRelative(
      relativeAzimuth(moonAz.current, facing) * kAz,
      s.moonAlt * kAlt,
      s.moonDir,
    );

    // --- day / night factors from the REAL sun altitude (degrees) ---
    const a = s.sunAlt * MathUtils.RAD2DEG;
    s.day = smoothstep(a, -2, 8);
    s.night = 1 - smoothstep(a, -12, -3);
    s.warmth = (1 - smoothstep(a, 2, 18)) * smoothstep(a, -8, 0);

    const { clouds, fog, temperatureC } = params;
    // Only a closing low/mid deck greys the sky — the gaps of a broken one
    // show clear blue; cirrus (in the total) only veils it.
    s.overcast = Math.max(
      smoothstep(clouds.low, 0.8, 1.0),
      smoothstep(Math.max(clouds.low, clouds.mid), 0.85, 1.0) * 0.8,
    );
    // The frame never shows the zenith, so a broken deck already fills most
    // of it with bright cloud (what the UI glass sits over).
    s.cloudFill = Math.max(
      smoothstep(clouds.low, 0.55, 1.0),
      smoothstep(Math.max(clouds.low, clouds.mid), 0.7, 1.0) * 0.8,
    );

    // --- haze & fog: Koschmieder — 95 % extinction at the visibility distance ---
    const heat = smoothstep(temperatureC, 28, 38);
    const visibility = Math.max(50, fog.visibilityM * (1 - heat * 0.5));
    const visUnits = visibility / METRES_PER_UNIT;
    s.fogDensity = MathUtils.clamp(1.73 / visUnits, 0.0004, 0.15);
    s.haze = MathUtils.clamp(1 - (Math.log10(visibility) - 2.5) / 1.9, 0, 1);

    const horizon = s.horizonColor.copy(DAY_HAZE).lerp(TWILIGHT, s.warmth);
    horizon.lerp(NIGHT_HAZE, s.night);
    if (heat > 0) horizon.lerp(HEAT_HAZE, heat * 0.5 * s.day);
    const overcastTint = scratch.current
      .copy(OVERCAST_DAY)
      .lerp(OVERCAST_NIGHT, s.night);
    horizon.lerp(overcastTint, s.overcast * 0.85);
    if (fog.rime) horizon.lerp(RIME_FOG, 0.6 * (1 - s.night * 0.85));
    // Under a storm the light at the horizon is dim too.
    if (params.thunder) horizon.multiplyScalar(0.72);

    // --- light colours (clouds) ---
    s.sunColor.copy(SUN_LOW).lerp(SUN_HIGH, smoothstep(a, 0, 20));
    s.moonIntensity =
      s.night *
      smoothstep(s.moonAlt * MathUtils.RAD2DEG, -1, 5) *
      (0.25 + 0.75 * s.moonFraction) *
      0.45 *
      (1 - 0.7 * s.overcast);
    s.hemiSky.copy(HEMI_NIGHT).lerp(HEMI_DAY, s.day);
    s.hemiSky.lerp(scratch.current.copy(HEMI_OVERCAST).multiplyScalar(0.25 + 0.75 * s.day), s.overcast * 0.7);
    s.hemiGround.copy(GROUND_NIGHT).lerp(GROUND_DAY, s.day);

    // --- wind with gusts ---
    const { speedMs, gustMs, fromDeg } = params.wind;
    const t = state.clock.elapsedTime;
    const speed = Math.max(
      MIN_DRIFT_MS,
      speedMs + (gustMs - speedMs) * Math.min(1, gustEnvelope(t)),
    );
    windVelocity(fromDeg, speed, facing, s.windVelocity);
    const dt = Math.min(delta, 0.1);

    // Clouds ride the winds aloft, not the surface wind (cloudPhysics.ts).
    const { windLow, windHigh } = params.cloudPhysics;
    windVelocity(windLow.fromDeg, Math.max(MIN_DRIFT_MS, windLow.speedMs), facing, s.windVelocityLow);
    windVelocity(windHigh.fromDeg, Math.max(MIN_DRIFT_MS, windHigh.speedMs), facing, s.windVelocityHigh);
    s.windOffsetLow.addScaledVector(s.windVelocityLow, dt);
    s.windOffsetHigh.addScaledVector(s.windVelocityHigh, dt);
  });

  return null;
}
