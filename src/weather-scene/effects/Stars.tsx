import { Stars as DreiStars } from "@react-three/drei";
import type { SimulationConfig } from "../types";
import { PHASE_PALETTES } from "../scene/phasePalette";

interface StarsProps {
  config: SimulationConfig;
  isMobile?: boolean;
}

/**
 * drei `<Stars>` wrapped with a conditional mount + count scale driven by
 * `PHASE_PALETTES[timeOfDay].starsOpacity`. drei's star fragment shader
 * hard-codes `fade == 1.0` as a binary check and has no continuous-opacity
 * uniform, so the practical way to dim stars is to thin the field.
 *
 * - day:  palette.starsOpacity = 0 → unmounted, zero cost.
 * - dawn / dusk: ~0.35 → ~900 stars, clearly visible but not overwhelming.
 * - night: 1.0 → full ~2500 / ~1200 stars (desktop / mobile).
 */
export function Stars({ config, isMobile = false }: StarsProps) {
  const palette = PHASE_PALETTES[config.timeOfDay];
  if (palette.starsOpacity <= 0) return null;

  const base = isMobile ? 1200 : 2500;
  const count = Math.max(200, Math.round(base * palette.starsOpacity));

  return (
    <DreiStars
      radius={80}
      depth={50}
      count={count}
      factor={3}
      saturation={0}
      fade
      speed={0.2}
    />
  );
}
