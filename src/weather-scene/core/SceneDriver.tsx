import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, MathUtils } from "three";
import * as SunCalc from "suncalc";
import type { SceneParams } from "../../weather/sceneParams";
import { useSceneSignals } from "./sceneSignals";
import type { ViewFrame } from "./viewVolume";
import {
  azimuthFromCompassDeg,
  directionFromRelative,
  facingFor,
  effectiveVisibilityM,
  heatShimmer,
  MIN_DRIFT_MS,
  relativeAzimuth,
  windVelocity,
} from "./worldFrame";
import { MAX_DT } from "./constants";
import {
  DAY_HAZE,
  GROUND_DAY,
  GROUND_NIGHT,
  HAZE_OVERCAST_DAY,
  HAZE_OVERCAST_DUSK,
  HAZE_OVERCAST_NIGHT,
  HEAT_HAZE,
  HEMI_DAY,
  HEMI_NIGHT,
  HEMI_OVERCAST,
  NIGHT_HAZE,
  RIME_FOG,
  SUN_HIGH,
  SUN_LOW,
  TWILIGHT,
} from "./palette";

interface SceneDriverProps {
  params: SceneParams;
  frame: ViewFrame;
}

/** Celestial bodies move slowly — recompute suncalc at most this often (ms). */
const CELESTIAL_INTERVAL = 1000;
/** Any azimuth up to ±135° from straight ahead is squeezed into 80 % of the half-frame. */
const AZ_SQUEEZE_RANGE = 135 * MathUtils.DEG2RAD;

const smoothstep = MathUtils.smoothstep;

/**
 * Real altitude → on-screen altitude, zenith at `top`. sin() lifts the mid-sky
 * body (45° → ~30° instead of ~21°, near the frame's centre) — the linear
 * squeeze kept the sun in the lower third most of the day. Below the horizon
 * it stays linear: Preetham's sky dies at −2.3° display, a steeper slope would end dusk early.
 */
function displayAltitude(alt: number, top: number): number {
  return alt >= 0 ? top * Math.sin(alt) : alt * (top / (Math.PI / 2));
}

/** On-screen sun/moon keep this far (NDC) outside the page's content column… */
const COVER_MARGIN = 0.07;
/** …and inside this, short of the frame edge. */
const EDGE_NDC = 0.92;
/** A narrower gutter (NDC) isn't worth it: the body keeps the plain squeeze. */
const MIN_GUTTER_NDC = 0.1;
/** The sun crosses behind the column within this share of ±135° (~±16°, about an hour around noon)… */
const CROSS_SHARE = 0.12;
/**
 * …the moon within ±2.7° (a quarter of an hour or so): it transits due south
 * (north) in the middle of the night, and at the sun's share it spent an hour
 * or two of the best moonlight behind the cards.
 */
const MOON_CROSS_SHARE = 0.02;

/**
 * Relative azimuth → on-screen azimuth at display altitude `alt`. With side
 * gutters next to the content column the body runs in them (morning left,
 * afternoon right, a quick crossing around noon) — in the middle it sat behind
 * the cards all day. The azimuth is solved for the pitched base camera so a
 * high body lands on the same screen x as a low one. No gutters: ±135° → 80 %
 * of the half-frame.
 */
function displayAzimuth(rel: number, alt: number, frame: ViewFrame, crossShare = CROSS_SHARE): number {
  const g0 = frame.coverHalf + COVER_MARGIN;
  if (frame.coverHalf <= 0 || EDGE_NDC - g0 < MIN_GUTTER_NDC) {
    return rel * Math.min(1, (0.8 * frame.hHalfRaw) / AZ_SQUEEZE_RANGE);
  }
  const u = MathUtils.clamp(rel / AZ_SQUEEZE_RANGE, -1, 1);
  const a = Math.abs(u);
  const x =
    a < crossShare
      ? (u / crossShare) * g0
      : Math.sign(u) * (g0 + ((EDGE_NDC - g0) * (a - crossShare)) / (1 - crossShare));
  // x·tanH·(cosφ·cos e·cos p + sin e·sin p) = sinφ·cos e, solved for φ.
  const k = x * Math.tan(frame.hHalfRaw);
  const ce = Math.cos(alt);
  const A = ce;
  const B = k * ce * Math.cos(frame.pitch);
  const C = k * Math.sin(alt) * Math.sin(frame.pitch);
  return Math.atan2(B, A) + Math.asin(MathUtils.clamp(C / Math.hypot(A, B), -1, 1));
}

/** How much nearer the frame's middle (rad) the moon must be than the sun to switch sides fully. */
const PAIR_INSIDE = 15 * MathUtils.DEG2RAD;

/**
 * The moon's relative azimuth for display. With both bodies up on the same
 * side, the moon — when it is the one nearer the middle — goes to the other
 * side (mirrored): an evening's waxing crescent rises on the left while the
 * sun sets on the right, a morning's waning moon the other way round; side by
 * side in one gutter they looked like a pair of lamps. The order stays true
 * (that moon is east of the evening sun, west of the morning one), the
 * mirror is continuous through the middle, and it eases out as either body
 * goes down — after twilight the moon glides back to its real side.
 */
function pairedMoonAzimuth(moonRel: number, sunRel: number, moonAlt: number, sunAlt: number): number {
  if (Math.sign(moonRel) !== Math.sign(sunRel)) return moonRel;
  // The sun's side stays lit through civil twilight: keep the pair apart until its glow fades.
  const both =
    smoothstep(sunAlt * MathUtils.RAD2DEG, -10, -4) * smoothstep(moonAlt * MathUtils.RAD2DEG, -2, 2);
  const inside = smoothstep(Math.abs(sunRel) - Math.abs(moonRel), 0, PAIR_INSIDE);
  return MathUtils.lerp(moonRel, -moonRel, both * inside);
}

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
      s.sunAlt = sun.altitude * MathUtils.DEG2RAD;
      s.moonAlt = moon.altitude * MathUtils.DEG2RAD;
      sunAz.current = azimuthFromCompassDeg(sun.azimuth);
      moonAz.current = azimuthFromCompassDeg(moon.azimuth);
      s.moonPhase = illum.phase;
      s.moonFraction = illum.fraction;
    }
    // Display direction: the zenith maps 5° under the frame's top edge, so the disc stays in view.
    const altTop = frame.topElevRaw - 5 * MathUtils.DEG2RAD;
    const sunAltD = displayAltitude(s.sunAlt, altTop);
    const moonAltD = displayAltitude(s.moonAlt, altTop);
    const sunRel = relativeAzimuth(sunAz.current, facing);
    const moonRel = relativeAzimuth(moonAz.current, facing);
    directionFromRelative(displayAzimuth(sunRel, sunAltD, frame), sunAltD, s.sunDir);
    directionFromRelative(
      displayAzimuth(pairedMoonAzimuth(moonRel, sunRel, s.moonAlt, s.sunAlt), moonAltD, frame, MOON_CROSS_SHARE),
      moonAltD,
      s.moonDir,
    );

    // --- day / night factors from the REAL sun altitude (degrees) ---
    const a = s.sunAlt * MathUtils.RAD2DEG;
    s.day = smoothstep(a, -2, 8);
    s.night = 1 - smoothstep(a, -12, -3);
    s.warmth = (1 - smoothstep(a, 2, 18)) * smoothstep(a, -8, 0);
    s.lowSun = 1 - smoothstep(a, 0, 10);

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
    const heat = heatShimmer(temperatureC);
    const visibility = effectiveVisibilityM(fog.visibilityM, temperatureC);
    s.haze = MathUtils.clamp(1 - (Math.log10(visibility) - 2.5) / 1.9, 0, 1);

    // Warm from a low sun down through twilight, the light failing until night
    // takes over — following `warmth` (0 again by −8°) the haze went back to
    // the day's pale blue-grey in late dusk and drew a grey band at the horizon.
    const horizon = s.horizonColor
      .copy(DAY_HAZE)
      .lerp(TWILIGHT, 1 - smoothstep(a, 2, 18))
      .multiplyScalar(1 - 0.55 * (1 - smoothstep(a, -8, 0)));
    horizon.lerp(NIGHT_HAZE, s.night);
    if (heat > 0) horizon.lerp(HEAT_HAZE, heat * 0.5 * s.day);
    // At dusk the deck's base glows red (VolumetricClouds lights it from ~6°
    // under the horizon) and the light fails: the haze under it goes dark and
    // warm until night takes over. Keyed to warmth, the day grey came back
    // as a pale lavender band under a red sky.
    const overcastTint = scratch.current
      .copy(HAZE_OVERCAST_DAY)
      .lerp(HAZE_OVERCAST_DUSK, s.lowSun)
      .lerp(HAZE_OVERCAST_NIGHT, s.night);
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
