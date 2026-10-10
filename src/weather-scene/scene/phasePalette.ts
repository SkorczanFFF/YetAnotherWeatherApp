import { Color } from "three";
import type { TimeOfDay } from "../types";

// Central palette for every time-of-day phase. One source of truth for sky
// gradient stops, cloud tint, sun/moon color, ambient + directional light,
// and the legacy boxColor (for the scene-reset cube until the dome lands).
// Anything that needs a per-phase color should read from here — not
// redeclare its own table.

export interface PhasePalette {
  /** Sky gradient horizon colour (bottom of the dome). */
  skyHorizon: Color;
  /** Sky gradient zenith colour (top of the dome). */
  skyZenith: Color;
  /** Cloud diffuse tint (multiplied with the FBM alpha mask). */
  cloudTint: Color;
  /** Sun disc colour. */
  sunTint: Color;
  /** Moon disc colour (warmed slightly at dusk/dawn). */
  moonTint: Color;
  /** 0..1 — how much star opacity to blend in. Night = 1, day = 0. */
  starsOpacity: number;
  /** Scene ambient light colour. */
  ambient: Color;
  ambientIntensity: number;
  /** Key-light colour (the implicit "sun" light, not the visual sun disc). */
  dirColor: Color;
  dirIntensity: number;
  dirPos: [number, number, number];
  /** Legacy — used by the reset-era cube. Remove when <SkyDome> lands. */
  boxColor: Color;
}

function hex(h: string): Color {
  return new Color(h);
}

export const PHASE_PALETTES: Record<TimeOfDay, PhasePalette> = {
  day: {
    skyHorizon: hex("#dfeffb"),
    skyZenith: hex("#4da0e6"),
    cloudTint: hex("#ffffff"),
    sunTint: hex("#fff6dc"),
    moonTint: hex("#d8dfe8"),
    starsOpacity: 0,
    ambient: hex("#eaf4ff"),
    ambientIntensity: 0.8,
    dirColor: hex("#fff6dc"),
    dirIntensity: 1.6,
    dirPos: [4, 6, 3],
    boxColor: hex("#f2f2f2"),
  },
  dusk: {
    skyHorizon: hex("#ff8a4a"),
    skyZenith: hex("#3a2a5c"),
    cloudTint: hex("#f6c8a0"),
    sunTint: hex("#ff7033"),
    moonTint: hex("#f0d0b8"),
    starsOpacity: 0.35,
    ambient: hex("#f0a080"),
    ambientIntensity: 0.55,
    dirColor: hex("#ff7733"),
    dirIntensity: 1.3,
    dirPos: [6, 1.5, 3],
    boxColor: hex("#f0ddc8"),
  },
  night: {
    skyHorizon: hex("#152140"),
    skyZenith: hex("#05081a"),
    cloudTint: hex("#5a6a88"),
    sunTint: hex("#ffeebb"),
    moonTint: hex("#e6ecf2"),
    starsOpacity: 1,
    ambient: hex("#3a4a66"),
    ambientIntensity: 0.35,
    dirColor: hex("#8aa2c4"),
    dirIntensity: 0.55,
    dirPos: [-3, 5, -2],
    boxColor: hex("#c2ccd8"),
  },
  dawn: {
    skyHorizon: hex("#ffab88"),
    skyZenith: hex("#5a4078"),
    cloudTint: hex("#f7d4c4"),
    sunTint: hex("#ffc78a"),
    moonTint: hex("#ecd7cc"),
    starsOpacity: 0.35,
    ambient: hex("#ffc8b0"),
    ambientIntensity: 0.7,
    dirColor: hex("#ffaa77"),
    dirIntensity: 1.2,
    dirPos: [-5, 2, 3],
    boxColor: hex("#f0ddcc"),
  },
};
