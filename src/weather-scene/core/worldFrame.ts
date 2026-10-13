import { MathUtils, Vector3 } from "three";

// World convention — the single place compass bearings and sky angles turn
// into scene vectors.
//
//   +Y up, camera at the origin looking down -Z, pitched up by CAMERA_PITCH.
//   -Z is the `facing` direction: south on the northern hemisphere, north on
//   the southern one, so the sun's daily arc always crosses the frame.
//   +X is to the viewer's right: west when facing south, east when facing north.
//
// Azimuths follow suncalc: radians from SOUTH, positive towards WEST.

type Facing = "south" | "north";

export const CAMERA_FOV = 50;
export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 4000;
export const CAMERA_PITCH = MathUtils.degToRad(22);
/** Parallax rig looks at a point this far ahead, so translation also tilts the view a hair. */
export const LOOK_DISTANCE = 30;
/** Camera translation (scene units) at parallaxAmount = 1. */
export const PARALLAX_RANGE = 1.5;

/** One scene unit ≈ 20 m; decides how visibility in metres maps onto FogExp2. */
export const METRES_PER_UNIT = 20;

/** Fallback ("potato" tier) cloud deck plane height (≈ 1.2 km). */
export const DECK_Y = 60;
/** Deck extends this far before fading into the horizon. */
export const DECK_FAR = 2400;
/** Earth radius for the volumetric cloud shell (curvature makes clouds converge at the horizon). */
export const EARTH_RADIUS_M = 6371000;
/** Eye height above ground for the volumetric raymarch. */
export const CAMERA_ALTITUDE_M = 2;

/**
 * Time-lapse for clouds driven by the real winds aloft (850 / 300 hPa):
 * metres of cloud drift per metre of air. Pure speed-up — the "stronger
 * aloft" part now comes from the data.
 */
export const CLOUD_TIMELAPSE = 4;
/** Clouds never stop completely — dead calm still reads as a frozen frame. */
export const MIN_DRIFT_MS = 0.6;

const FACING_AZIMUTH: Record<Facing, number> = { south: 0, north: Math.PI };

export function facingFor(lat: number): Facing {
  return lat >= 0 ? "south" : "north";
}

/** Wraps an angle to (-π, π]. */
function wrapPi(a: number): number {
  return a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
}

/** suncalc azimuth → azimuth relative to the camera's facing (0 = straight ahead, + = right). */
export function relativeAzimuth(azimuth: number, facing: Facing): number {
  return wrapPi(azimuth - FACING_AZIMUTH[facing]);
}

/** Unit vector for a relative azimuth + altitude (radians). */
export function directionFromRelative(
  relAz: number,
  alt: number,
  target = new Vector3(),
): Vector3 {
  const c = Math.cos(alt);
  return target.set(Math.sin(relAz) * c, Math.sin(alt), -Math.cos(relAz) * c);
}

/** Compass bearing (degrees, 0 = N, clockwise) → horizontal world unit vector pointing that way. */
function compassToWorld(
  bearingDeg: number,
  facing: Facing,
  target = new Vector3(),
): Vector3 {
  const azimuth = MathUtils.degToRad(bearingDeg) - Math.PI;
  return directionFromRelative(relativeAzimuth(azimuth, facing), 0, target);
}

/**
 * Wind velocity in world space (m/s, y = 0). `fromDeg` is where the wind
 * blows FROM, so the air moves the opposite way.
 */
export function windVelocity(
  fromDeg: number,
  speedMs: number,
  facing: Facing,
  target = new Vector3(),
): Vector3 {
  return compassToWorld(fromDeg, facing, target).multiplyScalar(-speedMs);
}

/** Human-readable screen drift for the debug readout, e.g. "right → left". */
export function describeScreenDrift(fromDeg: number, facing: Facing): string {
  const v = windVelocity(fromDeg, 1, facing);
  const parts: string[] = [];
  if (v.x < -0.38) parts.push("leftwards");
  else if (v.x > 0.38) parts.push("rightwards");
  if (v.z < -0.38) parts.push("away to the horizon");
  else if (v.z > 0.38) parts.push("towards the viewer");
  return parts.join(" + ") || "—";
}
