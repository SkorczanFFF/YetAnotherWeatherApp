// Maps the SimulationConfig's cloudCover (0..1) onto the shape controls of
// @takram/three-clouds so we get three clearly-distinguishable anchor states —
// clear, moderate (scattered / broken), and overcast — with smooth interpolation
// between them. Two knobs drive the look:
//
//   coverage      — the library's own coverage uniform (0..1). Directly
//                   controls how much of the sky holds cloud mass.
//   densityScale  — multiplier on the volumetric density. Raising it past 1
//                   drives a scattered field toward solid stratus.

export interface CloudTier {
  coverage: number;
  densityScale: number;
}

interface Anchor {
  cover: number;
  coverage: number;
  densityScale: number;
}

// Four anchors span cloudCover 0..1. The middle two give a distinctly broken
// and a distinctly overcast look; the extremes give genuine empty sky and
// thick stratus. Values between anchors smooth-lerp.
const ANCHORS: Anchor[] = [
  { cover: 0.0, coverage: 0.0, densityScale: 0.0 },
  { cover: 0.2, coverage: 0.28, densityScale: 0.6 },
  { cover: 0.55, coverage: 0.55, densityScale: 0.95 },
  { cover: 0.85, coverage: 0.85, densityScale: 1.25 },
  { cover: 1.0, coverage: 0.95, densityScale: 1.4 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function getCloudTier(cloudCover: number): CloudTier {
  const c = Math.max(0, Math.min(1, cloudCover));
  // Early-out at the low end so the <Clouds> pass is effectively free when
  // the sky should read as clear.
  if (c <= 0.05) return { coverage: 0, densityScale: 0 };

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i];
    const b = ANCHORS[i + 1];
    if (c >= a.cover && c <= b.cover) {
      const t = smoothstep(a.cover, b.cover, c);
      return {
        coverage: a.coverage + (b.coverage - a.coverage) * t,
        densityScale: a.densityScale + (b.densityScale - a.densityScale) * t,
      };
    }
  }
  const last = ANCHORS[ANCHORS.length - 1];
  return { coverage: last.coverage, densityScale: last.densityScale };
}
