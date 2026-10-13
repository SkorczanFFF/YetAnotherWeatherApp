/** Frosted-glass strength from the scene's temperature, humidity and icing. */

import { clamp01 } from "../utils/math";
import type { SceneParams } from "./sceneParams";

/** Temperature at which the frosted-glass effect reaches full strength, °C. */
const FROST_FULL_AT_C = -20;

/**
 * Frosted-glass strength, 0..1: eased from 0 °C to FROST_FULL_AT_C, scaled by
 * humidity; freezing precipitation and rime glaze the glass even near 0 °C.
 */
export function getFrostAmount(params: SceneParams): number {
  const cold = Math.pow(clamp01(params.temperatureC / FROST_FULL_AT_C), 1.6);
  const moisture = 0.55 + 0.45 * params.humidity;
  const glaze = params.precip.freezing || params.fog.rime ? 0.35 : 0;
  return clamp01(Math.max(cold * moisture, glaze));
}
