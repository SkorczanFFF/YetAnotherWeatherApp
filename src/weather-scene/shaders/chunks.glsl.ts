// GLSL helpers shared by several shaders, interpolated into their sources.

/** Rank (0..1) of a near-normal noise value with stats = (mean, σ), via the logistic CDF: an even share of the area. */
export const NOISE_RANK = /* glsl */ `
float noiseRank(float n, vec2 stats) {
  return 1.0 / (1.0 + exp(-1.702 * (n - stats.x) / stats.y));
}
`;

export const REMAP = /* glsl */ `
float remap(float v, float l0, float h0, float l1, float h1) {
  return l1 + (v - l0) * (h1 - l1) / (h0 - l0);
}
`;

/** Octave weights of every Worley FBM (generator and samplers must agree). */
export const FBM_WEIGHTS = /* glsl */ `
const vec3 FBM_WEIGHTS = vec3(0.625, 0.25, 0.125);
`;

/**
 * Cirrus alpha for a noise rank: streaks over the top `high` share of the
 * layer, denser as it fills; a closing high deck adds a milky cirrostratus veil.
 */
export const CIRRUS_ALPHA = /* glsl */ `
float cirrusAlpha(float rank, float high) {
  float streaks = smoothstep(1.0 - high - 0.08, 1.0 - high + 0.12, rank) * (0.35 + 0.3 * high);
  float veil = smoothstep(0.55, 1.0, high) * 0.18;
  return min(streaks + veil, 0.7);
}
`;
