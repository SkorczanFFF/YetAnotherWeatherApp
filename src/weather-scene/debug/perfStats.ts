import type { QualityTier } from "../../weather/sceneParams";

/**
 * Module-level perf readout. <PerfProbe> writes it from inside the Canvas;
 * the debug menu polls it from the DOM side. Not React state on purpose.
 */
export const perfStats = {
  fps: 0,
  calls: 0,
  triangles: 0,
  points: 0,
  tier: "high" as QualityTier,
};
