// The 2D sheets behind the volume: the mid layer over a low deck and the
// cirrus. Each composites itself into the march's (scat, T). Interpolated
// into CLOUD_MARCH_FRAG after CLOUD_DENSITY and CLOUD_LIGHTING.

export const CLOUD_LAYERS = /* glsl */ `
const vec2 CIRRUS_NOISE = vec2(0.490, 0.081);   // mean, σ — see COVER_NOISE
// Mid layer: cover cells ~2.5× smaller than the shell's (noise space ×), peak opacity.
const float MID_CELL_SCALE = 2.5;
const float MID_ALPHA = 0.8;

// Mid layer (altocumulus / altostratus) above a low deck: a thin sheet like
// the cirrus, behind the volume. Its cells come from the same calibrated
// cover field at a larger scale; a finer Worley breaks them into the
// cell-and-gap texture, thinner where the cover thins out.
void midLayer(vec3 ro, vec3 rd, float cosTheta, inout vec3 scat, inout float T) {
  float tm = raySphere(ro, rd, uEarthR + uMidAlt).y;
  if (tm > 0.0 && tm < 120000.0) {
    vec2 xz = (ro + rd * tm).xz - uWindHigh * 0.5;
    vec2 ranks = coverRank(xz * MID_CELL_SCALE, 0.5);
    float c = uMid;
    float cov = smoothstep(1.0 - c - COVER_EDGE, 1.0 - c + COVER_EDGE, ranks.x)
      * smoothstep(1.0 - c - ISLAND_REACH - 0.1, 1.0 - c - ISLAND_REACH, ranks.y);
    cov = clamp(cov + smoothstep(0.85, 1.0, c), 0.0, 1.0);
    float cells = noise3(vec3(xz / 1600.0, 0.83)).g;
    float a = smoothstep(0.05, 0.95, cov * mix(0.45, 1.25, cells)) * MID_ALPHA
      * (1.0 - smoothstep(60000.0, 120000.0, tm));
    // Thicker cores shade themselves; the forward lobe lights the sunward rims.
    vec3 col = (uLightColor * mix(hg(cosTheta, 0.55), 1.0, 0.55) * mix(0.95, 0.55, a)
      + mix(uAmbientBottom, uAmbientTop, 0.6) * 1.15) * mix(0.62, 1.05, cells);
    col = mix(col, uHazeColor, 1.0 - exp(-tm / (uHazeDist * 2.0)));
    scat += T * col * a;
    T *= 1.0 - a;
  }
}

// Cirrus: thin streaks on a high shell, stretched along the wind, behind the volume.
void cirrusLayer(vec3 ro, vec3 rd, float cosTheta, inout vec3 scat, inout float T) {
  float tc = raySphere(ro, rd, uEarthR + uCirrusAlt).y;
  if (tc > 0.0 && tc < 160000.0) {
    vec2 q = (ro + rd * tc).xz - uWindHigh;
    vec2 qw = vec2(dot(q, uHighWindDir), dot(q, vec2(-uHighWindDir.y, uHighWindDir.x)));
    float n = noise3(vec3(qw.x / 90000.0, qw.y / 14000.0, 0.57)).g;
    n = n * 0.7 + noise3(vec3(qw.x / 30000.0, qw.y / 5000.0, 0.11)).b * 0.3;
    float a = cirrusAlpha(noiseRank(n, CIRRUS_NOISE), uHigh) * (1.0 - smoothstep(60000.0, 160000.0, tc));
    vec3 col = uLightColor * mix(hg(cosTheta, 0.6), 1.0, 0.5) * 0.9 + uAmbientTop * 1.2;
    col = mix(col, uHazeColor, 1.0 - exp(-tc / (uHazeDist * 2.5)));
    scat += T * col * a;
    T *= 1.0 - a;
  }
}
`;
