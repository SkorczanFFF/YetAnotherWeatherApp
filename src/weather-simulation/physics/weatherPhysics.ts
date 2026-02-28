/**
 * Physics-inspired parameters for weather simulation.
 * Wind (km/h) drives rain/snow drift. Intensity affects particle count only, not fall speed.
 */

export const RAIN_WIND_FACTOR = 0.018;
export const DRIZZLE_WIND_FACTOR = 0.028;
export const SNOW_WIND_FACTOR = 0.0025;
export const CLOUD_WIND_FACTOR = 0.0008;
export const MIST_WIND_FACTOR = 0.00032;
export const WIND_GUST_VARIANCE = 0.15;

/** Fixed rain fall speed; intensity controls spawn count only. */
export const RAIN_FALL_SPEED_BASE = 0.38;

/** Drizzle falls slower than rain; finer droplets. */
export const DRIZZLE_FALL_SPEED_BASE = 0.2;

/** Fixed snow fall speed; intensity controls spawn count only. */
export const SNOW_FALL_SPEED_BASE = 0.075;

export const THUNDERSTORM_WIND_MULTIPLIER = 1.8;
export const THUNDERSTORM_RAIN_MULTIPLIER = 1.2;
