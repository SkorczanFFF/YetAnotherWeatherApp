// Cloud deck: one horizontal plane in world space (true perspective),
// shaped to the frustum footprint at DECK_Y. Two layers in one pass:
//   LOW  — stratocumulus → stratus. Broken patches over the top uLow share
//          of the area (the low/mid deck cover) that close into a textured
//          blanket as it → 1.
//   HIGH — cirrus streaks, stretched along the wind direction, under the low
//          layer.
// The pre-baked tileable FBM (core/noiseTexture.ts) is sampled at world xz
// minus the accumulated wind drift, so clouds move with the real wind.
// Exp² fog towards the horizon colour (same maths and order as three's fog chunks).

import { DECK_FAR } from "../core/worldFrame";
import { CIRRUS_ALPHA, NOISE_RANK } from "./chunks.glsl";

/** Noise tiles of the deck, scene units: the low cover (and its ×2.7 octave), the cirrus along / across the wind. */
export const DECK_LOW_TILE = 220;
export const DECK_LOW_OCTAVE = 2.7;
export const DECK_HIGH_TILES = [700, 160] as const;

export const CLOUD_DECK_VERT = /* glsl */ `
varying vec3 vWorld;
varying float vFogDepth;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorld = worldPosition.xyz;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vFogDepth = -mvPosition.z;
}
`;

export const CLOUD_DECK_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform vec2 uDrift;       // accumulated 850 hPa drift, world units (xz), wrapped (cloudDrift.ts)
uniform vec2 uDriftHigh;   // accumulated 300 hPa drift (cirrus), along / across uWindDir, in HIGH_SCALE tiles
uniform vec2 uWindDir;     // unit, world xz — 300 hPa direction for the cirrus streaks
uniform float uLow;        // 0..1 deck cover (low, or mid when it dominates)
uniform float uHigh;       // 0..1 high cloud cover
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uHighColor;
const float FADE_FAR = ${DECK_FAR}.0;   // the deck fades out by here, scene units
uniform float uFlash;
uniform vec3 uFogColor;
uniform float uFogDensity;  // exp² density per scene unit

varying vec3 vWorld;
varying float vFogDepth;

const float LOW_SCALE = 1.0 / ${DECK_LOW_TILE}.0;
const vec2 HIGH_SCALE = vec2(1.0 / ${DECK_HIGH_TILES[0]}.0, 1.0 / ${DECK_HIGH_TILES[1]}.0);

// Measured over the 2D FBM texture (core/noiseTexture.ts), not the volumetric 3D
// noise: the mixes are near-normal (low mix μ 0.552 σ 0.081, single sample
// μ 0.552 σ 0.111); their logistic CDF gives an even 0..1 rank, so a cover c
// thresholds off exactly that share of the area.
const vec2 DECK_NOISE = vec2(0.552, 0.081);
const vec2 HIGH_NOISE = vec2(0.552, 0.111);
${NOISE_RANK}
${CIRRUS_ALPHA}

void main() {
  vec2 p = vWorld.xz;

  // LOW
  vec2 uvL = (p - uDrift) * LOW_SCALE;
  float n = texture2D(uNoise, uvL).r * 0.62 + texture2D(uNoise, uvL * ${DECK_LOW_OCTAVE} + 0.31).r * 0.38;
  float rank = noiseRank(n, DECK_NOISE);
  float aLow = smoothstep(1.0 - uLow - 0.1, 1.0 - uLow + 0.1, rank) * smoothstep(0.0, 0.05, uLow);
  // Overcast: the gaps close into a blanket that keeps some texture.
  float blanket = smoothstep(0.82, 0.98, uLow);
  aLow = mix(aLow, 0.88 + 0.12 * smoothstep(0.3, 0.7, n), blanket);
  float density = smoothstep(1.0 - uLow, 1.0, rank);
  vec3 colLow = mix(uLit, uShade, clamp(density * 0.75 + blanket * 0.3, 0.0, 1.0));

  // HIGH — rotate into the wind frame and stretch along it.
  vec2 w = uWindDir;
  vec2 qw = vec2(dot(p, w), dot(p, vec2(-w.y, w.x)));
  float nh = texture2D(uNoise, qw * HIGH_SCALE - uDriftHigh + 0.57).r;
  float rankHigh = noiseRank(nh, HIGH_NOISE);
  float aHigh = cirrusAlpha(rankHigh, uHigh) * smoothstep(0.0, 0.05, uHigh);

  float a = aLow + aHigh * (1.0 - aLow);
  vec3 col = (colLow * aLow + uHighColor * aHigh * (1.0 - aLow)) / max(a, 1e-4);

  float dist = length(vWorld.xz - cameraPosition.xz);
  a *= 1.0 - smoothstep(FADE_FAR * 0.55, FADE_FAR, dist);
  col += uFlash * 0.45;

  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, fogFactor);
}
`;
