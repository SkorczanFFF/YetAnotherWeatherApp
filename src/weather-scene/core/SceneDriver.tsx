import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import * as SunCalc from "suncalc";
import type { SceneParams } from "../../weather/sceneParams";
import { useSceneSignals } from "./sceneSignals";
import type { ViewFrame } from "./viewVolume";
import { azimuthFromCompassDeg, facingFor, MIN_DRIFT_MS, relativeAzimuth, windVelocity } from "./worldFrame";
import { displayDirections } from "./celestial";
import { updateSkyLight } from "./skyLight";
import { MAX_DT } from "./constants";

interface SceneDriverProps {
  params: SceneParams;
  frame: ViewFrame;
}

/** Celestial bodies move slowly — recompute suncalc at most this often (ms). */
const CELESTIAL_INTERVAL = 1000;

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
  const sunAz = useRef(0);
  const moonAz = useRef(0);

  useFrame((state, delta) => {
    const time = params.time ?? Date.now();
    const facing = facingFor(params.lat);

    // --- celestial (throttled; a params change forces a recompute) ---
    if (params !== lastParams.current || time - lastCelestial.current > CELESTIAL_INTERVAL) {
      lastParams.current = params;
      lastCelestial.current = time;
      const date = new Date(time);
      const sun = SunCalc.getPosition(date, params.lat, params.lon);
      const moon = SunCalc.getMoonPosition(date, params.lat, params.lon);
      const illum = SunCalc.getMoonIllumination(date);
      s.sunAlt = sun.altitude * MathUtils.DEG2RAD;
      s.moonAlt = moon.altitude * MathUtils.DEG2RAD;
      s.sunAltDeg = s.sunAlt * MathUtils.RAD2DEG;
      s.moonAltDeg = s.moonAlt * MathUtils.RAD2DEG;
      sunAz.current = azimuthFromCompassDeg(sun.azimuth);
      moonAz.current = azimuthFromCompassDeg(moon.azimuth);
      s.moonPhase = illum.phase;
      s.moonFraction = illum.fraction;
    }
    displayDirections(
      frame,
      s.sunAlt,
      relativeAzimuth(sunAz.current, facing),
      s.moonAlt,
      relativeAzimuth(moonAz.current, facing),
      s,
    );
    updateSkyLight(s, params);

    // --- wind with gusts ---
    const { speedMs, gustMs, fromDeg } = params.wind;
    const t = state.clock.elapsedTime;
    const speed = Math.max(
      MIN_DRIFT_MS,
      speedMs + (gustMs - speedMs) * Math.min(1, gustEnvelope(t)),
    );
    windVelocity(fromDeg, speed, facing, s.windVelocity);
    const dt = Math.min(delta, MAX_DT);

    // Clouds ride the winds aloft, not the surface wind (cloudPhysics.ts).
    const { windLow, windHigh } = params.cloudPhysics;
    windVelocity(windLow.fromDeg, Math.max(MIN_DRIFT_MS, windLow.speedMs), facing, s.windVelocityLow);
    windVelocity(windHigh.fromDeg, Math.max(MIN_DRIFT_MS, windHigh.speedMs), facing, s.windVelocityHigh);
    s.windOffsetLow.addScaledVector(s.windVelocityLow, dt);
    s.windOffsetHigh.addScaledVector(s.windVelocityHigh, dt);
  });

  return null;
}
