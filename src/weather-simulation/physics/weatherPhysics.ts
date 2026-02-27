/**
 * Physics-inspired parameters for weather simulation.
 * Wind (km/h) drives rain/snow drift. Intensity affects particle count only, not fall speed.
 */

import type { Intensity } from "../types";

export const RAIN_WIND_FACTOR = 0.018;
export const SNOW_WIND_FACTOR = 0.0025;
export const CLOUD_WIND_FACTOR = 0.0008;
export const MIST_WIND_FACTOR = 0.00032;
export const WIND_GUST_VARIANCE = 0.15;

/** Fixed rain fall speed; intensity controls spawn count only. */
export const RAIN_FALL_SPEED_BASE = 0.38;

/** @deprecated Use RAIN_FALL_SPEED_BASE; kept for compatibility. */
export const RAIN_FALL_SPEED: Record<Intensity, number> = {
  light: 0.2,
  moderate: 0.38,
  heavy: 0.55,
};

/** Fixed snow fall speed; intensity controls spawn count only. */
export const SNOW_FALL_SPEED_BASE = 0.075;

/** @deprecated Use SNOW_FALL_SPEED_BASE; kept for compatibility. */
export const SNOW_FALL_SPEED: Record<Intensity, number> = {
  light: 0.018,
  moderate: 0.048,
  heavy: 0.078,
};

export const THUNDERSTORM_WIND_MULTIPLIER = 1.8;
export const THUNDERSTORM_RAIN_MULTIPLIER = 1.2;
