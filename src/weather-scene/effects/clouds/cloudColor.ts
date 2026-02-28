/**
 * Cloud color from simulation config: clear → white, rain/storm/fog → gray.
 */

import type { SimulationConfig } from "../../../weather-simulation/types";

const WHITE = 0xffffff;

/**
 * Returns hex color for cloud material based on weather.
 * Clear → white; rain/thunderstorm/fog → grayer; intensity and thunderstorm darken further.
 */
export function getCloudColor(config: SimulationConfig): number {
  if (config.effectType === "clear") {
    return WHITE;
  }
  const intensityFactor =
    config.intensity === "heavy"
      ? 1
      : config.intensity === "moderate"
        ? 0.6
        : 0.3;
  const stormBonus = config.thunderstorm ? 0.25 : 0;
  const t = Math.min(1, intensityFactor + stormBonus);
  const r = Math.round(0xff - (0xff - 0x6a) * t);
  const g = Math.round(0xff - (0xff - 0x6a) * t);
  const b = Math.round(0xff - (0xff - 0x6a) * t);
  return (r << 16) | (g << 8) | b;
}
