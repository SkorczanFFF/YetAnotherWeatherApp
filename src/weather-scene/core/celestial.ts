import { type Camera, MathUtils, type Vector3, Vector4 } from "three";
import type { ViewFrame } from "./viewVolume";
import { CAMERA_PITCH, directionFromRelative } from "./worldFrame";

// Sun and moon on screen: real altitude/azimuth → the display direction
// squeezed into the frame (see CLAUDE.md › World convention), and the screen
// position of a direction. Pure: no React, no renderer.

/** Any azimuth up to ±135° from straight ahead is squeezed into 80 % of the half-frame. */
const AZ_SQUEEZE_RANGE = 135 * MathUtils.DEG2RAD;
/** The zenith maps this far under the frame's top edge, so the disc stays in view. */
const ZENITH_MARGIN = 5 * MathUtils.DEG2RAD;

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
  const A = Math.cos(alt);
  const B = k * A * Math.cos(CAMERA_PITCH);
  const C = k * Math.sin(alt) * Math.sin(CAMERA_PITCH);
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

/**
 * Display directions (unit vectors) of the sun and moon from their real
 * altitudes and azimuths relative to the facing direction (radians).
 */
export function displayDirections(
  frame: ViewFrame,
  sunAlt: number,
  sunRel: number,
  moonAlt: number,
  moonRel: number,
  outSun: Vector3,
  outMoon: Vector3,
): void {
  const altTop = frame.topElevRaw - ZENITH_MARGIN;
  const sunAltD = displayAltitude(sunAlt, altTop);
  const moonAltD = displayAltitude(moonAlt, altTop);
  directionFromRelative(displayAzimuth(sunRel, sunAltD, frame), sunAltD, outSun);
  directionFromRelative(
    displayAzimuth(pairedMoonAzimuth(moonRel, sunRel, moonAlt, sunAlt), moonAltD, frame, MOON_CROSS_SHARE),
    moonAltD,
    outMoon,
  );
}

export interface ScreenPoint {
  /** Screen position, 0..1 inside the frame (may lie outside it). */
  u: number;
  v: number;
  /** Clip w: > 0 when the direction is in front of the camera. */
  w: number;
  /** How far outside the frame (in screen units), 0 inside it. */
  offFrame: number;
}

const clip = new Vector4();

/** Where a direction at infinity (the sun, the moon, the horizon) lands on screen. */
export function projectToScreen(dir: Vector3, camera: Camera, out: ScreenPoint): ScreenPoint {
  clip.set(dir.x, dir.y, dir.z, 0).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  out.u = (clip.x / clip.w) * 0.5 + 0.5;
  out.v = (clip.y / clip.w) * 0.5 + 0.5;
  out.w = clip.w;
  out.offFrame = Math.max(-out.u, out.u - 1, -out.v, out.v - 1, 0);
  return out;
}
