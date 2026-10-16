// GLSL helpers shared by several shaders, interpolated into their sources.

import type { Color } from "three";

/** A number as a GLSL float literal, at float32 precision (7 significant digits). */
export const glslFloat = (v: number) => {
  const n = Number(v.toPrecision(7));
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
};

/** A palette colour as a GLSL `vec3` literal (its linear components, as stored). */
export const glslColor = (c: Color) => `vec3(${glslFloat(c.r)}, ${glslFloat(c.g)}, ${glslFloat(c.b)})`;

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

/** Interleaved gradient noise — cheap per-pixel jitter, decorrelated per frame. */
export const IGN = /* glsl */ `
float ign(vec2 p) {
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
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

/** Vertex shader of a camera-facing quad (sun glow, moon): passes the UV through. */
export const BILLBOARD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
