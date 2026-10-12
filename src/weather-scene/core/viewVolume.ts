import { MathUtils } from "three";
import {
  CAMERA_FOV,
  CAMERA_PITCH,
  LOOK_DISTANCE,
  PARALLAX_RANGE,
} from "./worldFrame";

// "Only where the camera looks": every layer spawns into a volume derived
// from the BASE camera frustum (static position + pitch), padded by a small
// angular margin that covers the parallax rig. Anything outside never exists.
//
// Geometry: the camera sits at the origin looking down -Z, pitched up. For a
// point at horizontal distance d (along -Z) and height y:
//   depth along the view axis = d·cos(pitch) + y·sin(pitch)
//   visible half-width        = depth · tan(horizontal half-FOV)
//   visible height range      = [d·tan(bottomElev), d·tan(topElev)]
// The vertical range uses the frame's centre column, which holds the extreme
// elevations — corners sit lower/higher only by less — so it's a superset.

export interface ViewFrame {
  pitch: number;
  /** Raw (unpadded) angles — used for celestial compression. */
  hHalfRaw: number;
  topElevRaw: number;
  /** Padded angles — used for spawn volumes. */
  topElev: number;
  bottomElev: number;
  tanTop: number;
  tanBottom: number;
  tanH: number;
}

export function createViewFrame(aspect: number, parallaxAmount: number): ViewFrame {
  const vHalf = MathUtils.degToRad(CAMERA_FOV / 2);
  const hHalfRaw = Math.atan(Math.tan(vHalf) * aspect);
  const parallaxAngle = Math.atan(
    (Math.max(0, parallaxAmount) * PARALLAX_RANGE) / LOOK_DISTANCE,
  );
  const margin = MathUtils.degToRad(2) + parallaxAngle;
  const topElev = CAMERA_PITCH + vHalf + margin;
  const bottomElev = CAMERA_PITCH - vHalf - margin;
  const hHalf = Math.min(hHalfRaw + margin, MathUtils.degToRad(85));
  return {
    pitch: CAMERA_PITCH,
    hHalfRaw,
    topElevRaw: CAMERA_PITCH + vHalf,
    topElev,
    bottomElev,
    tanTop: Math.tan(topElev),
    tanBottom: Math.tan(bottomElev),
    tanH: Math.tan(hHalf),
  };
}

/** Visible half-width (x) at horizontal distance `d` and height `y`. */
export function halfWidthAt(f: ViewFrame, d: number, y: number): number {
  const depth = d * Math.cos(f.pitch) + y * Math.sin(f.pitch);
  return Math.max(0, depth) * f.tanH;
}

/**
 * Nearest horizontal distance at which an object whose LOWEST point is at
 * height `y` (> 0) can still be inside the frame. Anything closer is above
 * the top edge.
 */
export function nearestVisibleDistance(f: ViewFrame, y: number): number {
  return Math.max(0, y) / f.tanTop;
}

/** Near-field volume for precipitation particles. */
export interface PrecipVolume {
  dNear: number;
  dFar: number;
  /** Extra height above the top edge / below the bottom edge. */
  pad: number;
}

export function topAt(f: ViewFrame, v: PrecipVolume, d: number): number {
  return d * f.tanTop + v.pad;
}

export function bottomAt(f: ViewFrame, v: PrecipVolume, d: number): number {
  return d * f.tanBottom - v.pad;
}

/** Samples a horizontal distance in [dNear, dFar] with density ∝ d (uniform per volume). */
export function sampleDistance(dNear: number, dFar: number, u = Math.random()): number {
  const a = dNear * dNear;
  const b = dFar * dFar;
  return Math.sqrt(a + (b - a) * u);
}

/** Star patch: angular bounds of the frame on the sky sphere. */
export interface SkyPatch {
  relAzMax: number;
  elevMin: number;
  elevMax: number;
}

export function skyPatch(f: ViewFrame): SkyPatch {
  const elevMax = Math.min(f.topElev, MathUtils.degToRad(89));
  // Horizontal angular spread grows ~1/cos(elevation) towards the top edge.
  const relAzMax = Math.min(Math.PI, Math.atan(f.tanH / Math.cos(elevMax)));
  return { relAzMax, elevMin: Math.max(-0.02, f.bottomElev), elevMax };
}
