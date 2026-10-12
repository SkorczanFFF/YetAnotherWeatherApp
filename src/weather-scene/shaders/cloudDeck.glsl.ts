// Cloud deck: one horizontal plane in world space (true perspective),
// shaped to the frustum footprint at DECK_Y. Two layers in one pass:
//   LOW  — stratocumulus → stratus. Broken patches that close into a
//          textured blanket as low cover → 1.
//   HIGH — cirrus streaks, stretched along the wind direction, under the low
//          layer.
// The pre-baked tileable FBM (core/noiseTexture.ts) is sampled at world xz
// minus the accumulated wind drift, so clouds move with the real wind.
// FogExp2 chunks fade it into the horizon colour.

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
uniform float uLow;        // 0..1 low cloud cover
uniform float uHigh;       // 0..1 high cloud cover
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uHighColor;
uniform float uFadeFar;
uniform float uFlash;

varying vec3 vWorld;

const float LOW_SCALE = 1.0 / 220.0;
const vec2 HIGH_SCALE = vec2(1.0 / 700.0, 1.0 / 160.0);

void main() {
  vec2 p = vWorld.xz;

  // LOW
  vec2 uvL = (p - uDrift) * LOW_SCALE;
  float n = texture2D(uNoise, uvL).r * 0.62 + texture2D(uNoise, uvL * 2.7 + 0.31).r * 0.38;
  float c = clamp((uLow - 0.3) / 0.7, 0.0, 1.0);
  float thr = mix(0.78, 0.2, c);
  float aLow = smoothstep(thr, thr + 0.16, n);
  // Overcast: the gaps close into a blanket that keeps some texture.
  float blanket = smoothstep(0.82, 0.98, uLow);
  aLow = mix(aLow, 0.88 + 0.12 * smoothstep(0.3, 0.7, n), blanket);
  aLow *= smoothstep(0.3, 0.42, uLow);
  float density = smoothstep(thr, thr + 0.45, n);
  vec3 colLow = mix(uLit, uShade, clamp(density * 0.75 + blanket * 0.3, 0.0, 1.0));

  // HIGH — rotate into the wind frame and stretch along it.
  vec2 q = p - uDriftHigh;
  vec2 w = uWindDir;
  vec2 qw = vec2(dot(q, w), dot(q, vec2(-w.y, w.x)));
  float nh = texture2D(uNoise, qw * HIGH_SCALE + 0.57).r;
  float aHigh = smoothstep(0.55, 0.8, nh) * uHigh * 0.55;

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
