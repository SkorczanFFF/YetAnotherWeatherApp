/** Wind (km/h) drives drift; intensity affects particle count only. */
export const RAIN_WIND_FACTOR = 0.018;
export const DRIZZLE_WIND_FACTOR = 0.028;
export const SNOW_WIND_FACTOR = 0.0025;
export const CLOUD_WIND_FACTOR = 0.0008;
export const MIST_WIND_FACTOR = 0.00032;
export const WIND_GUST_VARIANCE = 0.15;

export const RAIN_FALL_SPEED_BASE = 0.38;
export const DRIZZLE_FALL_SPEED_BASE = 0.2;
export const SNOW_FALL_SPEED_BASE = 0.075;

export const THUNDERSTORM_WIND_MULTIPLIER = 1.8;
export const THUNDERSTORM_RAIN_MULTIPLIER = 1.2;

/** Convert wind direction (degrees) + speed into X/Z components. */
export function windToXZ(dirDeg: number, speed: number, factor: number) {
  const rad = (dirDeg * Math.PI) / 180;
  return { x: Math.sin(rad) * speed * factor, z: -Math.cos(rad) * speed * factor };
}
