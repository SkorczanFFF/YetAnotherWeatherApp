// Cloud deck: one horizontal plane in world space (true perspective),
// shaped to the frustum footprint at DECK_Y. Two layers in one pass:
//   LOW  — stratocumulus → stratus. Broken patches over the top uLow share
//          of the area (the low/mid deck cover) that close into a textured
//          blanket as it → 1.
//   HIGH — cirrus streaks, stretched along the wind direction, under the low
//          layer.
// The pre-baked tileable FBM (core/noiseTexture.ts) is sampled at world xz
// minus the accumulated wind drift, so clouds move with the real wind.
// FogExp2 chunks fade it into the horizon colour.

import { CIRRUS_ALPHA, NOISE_RANK } from "./chunks.glsl";

export const CLOUD_DECK_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorld = worldPosition.xyz;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const CLOUD_DECK_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>

uniform sampler2D uNoise;
uniform vec2 uDrift;       // accumulated 850 hPa drift, world units (xz)
uniform vec2 uDriftHigh;   // accumulated 300 hPa drift (cirrus), world units (xz)
uniform vec2 uWindDir;     // unit, world xz — 300 hPa direction for the cirrus streaks
uniform float uLow;        // 0..1 deck cover (low, or mid when it dominates)
uniform float uHigh;       // 0..1 high cloud cover
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uHighColor;
uniform float uFadeFar;
uniform float uFlash;

varying vec3 vWorld;

const float LOW_SCALE = 1.0 / 220.0;
const vec2 HIGH_SCALE = vec2(1.0 / 700.0, 1.0 / 160.0);

// The FBM mixes are near-normal (measured: low mix μ 0.552 σ 0.081, single
// sample μ 0.552 σ 0.111); their logistic CDF gives an even 0..1 rank, so a
// cover c thresholds off exactly that share of the area.
const vec2 DECK_NOISE = vec2(0.552, 0.081);
const vec2 HIGH_NOISE = vec2(0.552, 0.111);
${NOISE_RANK}
${CIRRUS_ALPHA}

void main() {
  vec2 p = vWorld.xz;

  // LOW
  vec2 uvL = (p - uDrift) * LOW_SCALE;
  float n = texture2D(uNoise, uvL).r * 0.62 + texture2D(uNoise, uvL * 2.7 + 0.31).r * 0.38;
  float rank = noiseRank(n, DECK_NOISE);
  float aLow = smoothstep(1.0 - uLow - 0.1, 1.0 - uLow + 0.1, rank) * smoothstep(0.0, 0.05, uLow);
  // Overcast: the gaps close into a blanket that keeps some texture.
  float blanket = smoothstep(0.82, 0.98, uLow);
  aLow = mix(aLow, 0.88 + 0.12 * smoothstep(0.3, 0.7, n), blanket);
  float density = smoothstep(1.0 - uLow, 1.0, rank);
  vec3 colLow = mix(uLit, uShade, clamp(density * 0.75 + blanket * 0.3, 0.0, 1.0));

  // HIGH — rotate into the wind frame and stretch along it.
  vec2 q = p - uDriftHigh;
  vec2 w = uWindDir;
  vec2 qw = vec2(dot(q, w), dot(q, vec2(-w.y, w.x)));
  float nh = texture2D(uNoise, qw * HIGH_SCALE + 0.57).r;
  float rankHigh = noiseRank(nh, HIGH_NOISE);
  float aHigh = cirrusAlpha(rankHigh, uHigh) * smoothstep(0.0, 0.05, uHigh);

  float a = aLow + aHigh * (1.0 - aLow);
  vec3 col = (colLow * aLow + uHighColor * aHigh * (1.0 - aLow)) / max(a, 1e-4);

  float dist = length(vWorld.xz - cameraPosition.xz);
  a *= 1.0 - smoothstep(uFadeFar * 0.55, uFadeFar, dist);
  col += uFlash * 0.45;

  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
