/** Cloud color from config: clear → white, rain/storm/fog → gray. Supports manual override (0 = white, 1 = dark gray). */
import type { SimulationConfig } from "../../types";

const WHITE = 0xffffff;

function lerpGray(t: number): number {
  const v = Math.round(0xff - (0xff - 0x6a) * Math.min(1, Math.max(0, t)));
  return (v << 16) | (v << 8) | v;
}

/** Shift a gray hex color by a signed brightness offset (clamped 0–255). */
export function shiftGray(hex: number, offset: number): number {
  const base = hex & 0xff;
  const v = Math.max(0, Math.min(0xff, base + offset));
  return (v << 16) | (v << 8) | v;
}

export function getCloudColor(config: SimulationConfig): number {
  if (config.cloudColorOverride !== undefined) {
    return lerpGray(config.cloudColorOverride);
  }
  if (config.effectType === "snow") {
    return WHITE;
  }
  if (config.thunderstorm) {
    return 0x5a5a5a;
  }
  if (config.effectType === "clear") {
    return WHITE;
  }
  const intensityFactor =
    config.intensity === "heavy"
      ? 1
      : config.intensity === "moderate"
        ? 0.6
        : 0.3;
  return lerpGray(intensityFactor);
}
