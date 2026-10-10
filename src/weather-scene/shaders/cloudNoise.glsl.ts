// One-off generator for the volumetric cloud noise: a tileable RGBA 3D
// texture rendered slice by slice into a WebGL3DRenderTarget at startup.
//   R — Perlin-Worley (Perlin fbm remapped by low-frequency Worley fbm):
//       the billowy base shape of cumulus.
//   G, B, A — Worley fbm at 4, 8, 16 cells per tile: shape fbm (low-res
//       sampling) and the high-frequency detail used to erode edges.
// Everything wraps with the tile period, so wind can scroll it forever.

export const CLOUD_NOISE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const CLOUD_NOISE_FRAG = /* glsl */ `
precision highp float;

uniform float uSlice; // z of this slice, 0..1
varying vec2 vUv;

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

// Inverted Worley F1 (1 at feature points), tileable with period = freq.
float worley(vec3 p, float freq) {
  vec3 id = floor(p * freq);
  vec3 f = fract(p * freq);
  float minD = 1.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 h = hash33(mod(id + o, freq));
    vec3 d = o + h - f;
    minD = min(minD, dot(d, d));
  }
  return 1.0 - sqrt(minD);
}

float worleyFbm(vec3 p, float freq) {
  return worley(p, freq) * 0.625 + worley(p, freq * 2.0) * 0.25 + worley(p, freq * 4.0) * 0.125;
}

vec3 grad(vec3 cell, float freq) {
  return normalize(hash33(mod(cell, freq)) * 2.0 - 1.0);
}

// Tileable gradient (Perlin) noise, -1..1.
float perlin(vec3 p, float freq) {
  vec3 x = p * freq;
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(grad(i + vec3(0, 0, 0), freq), f - vec3(0, 0, 0));
  float n100 = dot(grad(i + vec3(1, 0, 0), freq), f - vec3(1, 0, 0));
  float n010 = dot(grad(i + vec3(0, 1, 0), freq), f - vec3(0, 1, 0));
  float n110 = dot(grad(i + vec3(1, 1, 0), freq), f - vec3(1, 1, 0));
  float n001 = dot(grad(i + vec3(0, 0, 1), freq), f - vec3(0, 0, 1));
  float n101 = dot(grad(i + vec3(1, 0, 1), freq), f - vec3(1, 0, 1));
  float n011 = dot(grad(i + vec3(0, 1, 1), freq), f - vec3(0, 1, 1));
  float n111 = dot(grad(i + vec3(1, 1, 1), freq), f - vec3(1, 1, 1));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

float perlinFbm(vec3 p, float freq) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 5; i++) {
    sum += perlin(p, freq) * amp;
    norm += amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum / norm;
}

float remap(float v, float l0, float h0, float l1, float h1) {
  return l1 + (v - l0) * (h1 - l1) / (h0 - l0);
}

void main() {
  vec3 p = vec3(vUv, uSlice);
  float w1 = worleyFbm(p, 4.0);
  float w2 = worleyFbm(p, 8.0);
  float w3 = worleyFbm(p, 16.0);
  float pf = clamp(perlinFbm(p, 4.0) * 0.5 + 0.5, 0.0, 1.0);
  float perlinWorley = clamp(remap(pf, 0.0, 1.0, w1, 1.0), 0.0, 1.0);
  gl_FragColor = vec4(perlinWorley, w1, w2, w3);
}
`;
