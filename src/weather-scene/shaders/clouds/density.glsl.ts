// Cloud shape: the shell geometry, the calibrated cover field and the density
// at a point. Interpolated into CLOUD_MARCH_FRAG after its uniforms and the
// shared chunks (remap, noiseRank, FBM_WEIGHTS).

/** Noise tiles, m of noise space (the 3D noise repeats every tile) — cloudDrift.ts wraps the drift by them. */
export const SHAPE_TILE_M = 3200;
export const DETAIL_TILE_M = 520;
export const COVER_TILE_M = 10000;
/** The cover field's lookups, × the cover tile's scale: large cells, their mid part, the fine rims. */
export const COVER_OCTAVES = [1, 0.43, 2.3] as const;
/** The shell's cover fades in over 0..this (VolumetricClouds skips the march well inside it). */
export const COVER_FADE_IN = 0.05;

export const CLOUD_DENSITY = /* glsl */ `
const float SHAPE_SCALE = 1.0 / ${SHAPE_TILE_M}.0;
const float DETAIL_SCALE = 1.0 / ${DETAIL_TILE_M}.0;
const float WEATHER_SCALE = 1.0 / ${COVER_TILE_M}.0;

// Every noise lookup is explicit-LOD (the 3D noise has no mips, so the values
// are the same): implicit derivatives are undefined inside the march's
// data-dependent loops, and ANGLE's D3D11 backend (Chrome on Windows) returned
// an empty ray wherever the march broke out early — every opaque cloud nearby.
vec4 noise3(vec3 p) {
  return textureLod(uNoise, p, 0.0);
}

// Ray vs sphere centred at the Earth's centre; returns (near, far) or (-1).
vec2 raySphere(vec3 ro, vec3 rd, float r) {
  vec3 oc = ro + vec3(0.0, EARTH_R, 0.0);
  float b = dot(oc, rd);
  float c = dot(oc, oc) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float heightFraction(vec3 p) {
  return (length(p + vec3(0.0, EARTH_R, 0.0)) - EARTH_R - uBase) / uThickness;
}

// Vertical density profile per cloud type: flat stratus, bottom-heavy
// cumulus (rounded tops once coverage erodes it), tall cumulonimbus.
float heightGradient(float hf) {
  float stratus = smoothstep(0.0, 0.2, hf) * (1.0 - smoothstep(0.5, 0.9, hf));
  float cumulus = smoothstep(0.0, 0.08, hf) * (1.0 - smoothstep(0.25, 0.95, hf));
  float cb = smoothstep(0.0, 0.05, hf) * (1.0 - smoothstep(0.8, 1.0, hf));
  return uType < 0.5
    ? mix(stratus, cumulus, uType * 2.0)
    : mix(cumulus, cb, uType * 2.0 - 1.0);
}

// Measured stats of the near-normal, very narrow noise mixes, so noiseRank()
// gives an even 0..1 rank and cover c keeps exactly c of the area.
// Re-measure if cloudNoise.glsl changes.
const vec2 COVER_NOISE = vec2(0.624, 0.050);   // mean, standard deviation
const vec2 COVER_NOISE_LOW = vec2(0.659, 0.056);   // its large-scale part alone
const float COVER_EDGE = 0.18;   // half-width of a cell edge, in rank
// How far under the cover threshold (in rank) the large-scale field may sit
// for the fine component to still raise cloud: it shapes the rims of cells
// but spawns no isolated islands — each floated as a smooth round ball.
const float ISLAND_REACH = 0.12;
// The shell's cover fades in over 0..COVER_FADE_IN.
const float COVER_FADE_IN = ${COVER_FADE_IN};

// A cell's share of cover c from its ranks. Deliberately wide edge: the cover
// falling off at a cell's rim rounds its top; a sharp mask extrudes into
// vertical walls. Gated by the large-scale rank (ISLAND_REACH).
float coverMask(vec2 ranks, float c) {
  return smoothstep(1.0 - c - COVER_EDGE, 1.0 - c + COVER_EDGE, ranks.x)
    * smoothstep(1.0 - c - ISLAND_REACH - 0.1, 1.0 - c - ISLAND_REACH, ranks.y);
}

// A closing deck fills the gaps between its cells.
float closeGaps(float cov, float c) {
  return clamp(cov + smoothstep(0.85, 1.0, c), 0.0, 1.0);
}

// Rank (0..1) of the slowly scrolling weather noise — the top uCoverage share
// is cloud — and (y) the rank of its large-scale part alone.
vec2 coverRank(vec2 xz, float hf) {
  vec2 q = xz * WEATHER_SCALE;
  // Perlin-Worley + Worley at two scales — irregular cells, not round blobs.
  // Drifting through the third axis with height makes rims lean and bulge
  // instead of extruding into vertical curtains; every slice has the same stats.
  float large = noise3(vec3(q * ${COVER_OCTAVES[0]}.0, 0.31 + uEvolve * 0.05 + hf * 0.06)).r * 0.55
              + noise3(vec3(q * ${COVER_OCTAVES[1]} + 0.29, 0.52 + hf * 0.12)).g * 0.25;
  float n = large + noise3(vec3(q * ${COVER_OCTAVES[2]} + 0.17, 0.73 + hf * 0.3)).g * 0.2;
  return vec2(noiseRank(n, COVER_NOISE), noiseRank(large / 0.8, COVER_NOISE_LOW));
}

// Density at p (0..1). column: a closing deck's column thickness there,
// relative to its mean (its lumpy-base factor; 1 elsewhere).
float density(vec3 p, float hf, bool detail, out float column) {
  column = 1.0;
  if (hf < 0.0 || hf > 1.0) return 0.0;
  // Noise space is metres ÷ uFeatureScale, so a low deck keeps cumulus-sized cells
  // on screen. uWind is already in noise space: a changing scale zooms around the camera.
  vec2 pn = p.xz / uFeatureScale;
  vec2 xz = pn - uWind;
  float y = p.y / uFeatureScale;
  float c = uCoverage;
  vec2 ranks = coverRank(xz, hf);
  float rank = ranks.x;
  float cov = coverMask(ranks, c) * smoothstep(0.0, COVER_FADE_IN, c);
  // Convective towers narrow with height (stacked, rounded tops), so even a
  // tall cumulonimbus isn't its cell's footprint extruded into a column.
  cov *= 1.0 - 0.45 * smoothstep(0.35, 0.9, uType) * smoothstep(0.15, 1.0, hf);
  // Cumulonimbus anvil: near the top each cell spreads into a wider halo of
  // its own — not into the clear air between cells.
  if (uType > 0.9) {
    float halo = smoothstep(1.0 - c - COVER_EDGE - 0.25, 1.0 - c, rank) * smoothstep(0.0, COVER_FADE_IN, c);
    cov = max(cov, smoothstep(0.75, 0.95, hf) * 0.85 * halo);
  }
  cov = closeGaps(cov, c);
  if (cov < 0.01) return 0.0;

  vec3 uvw = vec3(xz.x, y + uEvolve * 400.0, xz.y) * SHAPE_SCALE;
  vec4 n = noise3(uvw);
  float lowFbm = dot(n.gba, FBM_WEIGHTS);
  float base = remap(n.r, lowFbm - 1.0, 1.0, 0.0, 1.0);
  base *= heightGradient(hf);
  base = remap(base, 1.0 - cov, 1.0, 0.0, 1.0) * cov;
  // A closed deck still has structure: undulating, lumpy base.
  column = mix(1.0, 0.35 + 1.1 * lowFbm, smoothstep(0.75, 1.0, c));
  base *= column;
  if (base <= 0.0) return 0.0;

  if (detail) {
    // Its own drift: the same wind, wrapped by the detail tile instead.
    vec2 dxz = pn - uWindDetail;
    vec3 duvw = vec3(dxz.x, y, dxz.y) * DETAIL_SCALE + vec3(uEvolve * 2.0);
    vec4 d = noise3(duvw);
    float hfFbm = dot(d.gba, FBM_WEIGHTS);
    // Wispy bottoms, billowy tops; above the freezing level the cloud is
    // glaciated — softer, fibrous edges (anvils, ice tops).
    float altitude = hf * uThickness + uBase;
    float ice = smoothstep(uFreezeAlt, uFreezeAlt + 1500.0, altitude);
    float modifier = mix(hfFbm, 1.0 - hfFbm, clamp(hf * 6.0, 0.0, 1.0) * (1.0 - ice * 0.7));
    base = remap(base, modifier * (0.5 + 0.2 * ice), 1.0, 0.0, 1.0);
  }
  return clamp(base, 0.0, 1.0);
}

float density(vec3 p, float hf, bool detail) {
  float column;
  return density(p, hf, detail, column);
}
`;
