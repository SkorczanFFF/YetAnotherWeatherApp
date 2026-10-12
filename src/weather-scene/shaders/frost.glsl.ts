// Frosted glass: ice creeping in from the corners and edges of the "window".
// uAmount (0..1) drives both how far the frost has grown and how opaque it
// is, so a few degrees below zero leave faint patches in the corners and
// −20 °C a translucent frame around a clear centre — the scene always shows
// through. The front, ferns and glints come from the shared tileable FBM
// texture, sampled with a mip bias for a soft, blurred look; a handful of
// texture reads per pixel and nothing outside the frost.

export const FROST_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform float uAmount;
uniform float uAspect;   // width / height
uniform vec3 uTint;

varying vec2 vUv;

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// Furthest the frost grows at uAmount 1, in units of the shorter screen side.
const float MAX_REACH = 0.32;

void main() {
  // Work in units of the shorter screen side so the frost isn't stretched.
  vec2 size = uAspect >= 1.0 ? vec2(uAspect, 1.0) : vec2(1.0, 1.0 / uAspect);
  vec2 p = vUv * size;
  vec2 e = min(p, size - p);
  // Geometric mean of the edge distances: the corners frost first, the middle
  // of each edge only once the frost is well established.
  float d = sqrt(e.x * e.y);

  // Reach grows roughly linearly with the frost, opacity follows below.
  float reach = MAX_REACH * pow(uAmount, 0.7);
  // Blurred, coarse noise for a wavy front instead of a jagged one.
  float nA = texture2D(uNoise, p * 0.9, 2.0).r;
  float nB = texture2D(uNoise, p * 2.7 + 0.37, 1.5).r;
  float front = reach * (0.55 + 0.9 * (nA * 0.7 + nB * 0.3));
  float soft = 0.45 * front + 0.01;
  float mask = 1.0 - smoothstep(front - soft, front + 0.25 * soft, d);
  if (mask < 0.004) discard;

  // 0 at the growth front, 1 at the frame — older ice is thicker.
  float depth = clamp((front - d) / max(front, 1e-3), 0.0, 1.0);

  // Soft crystal ferns: ridged noise on domain-warped coordinates (so the
  // 256² tile never visibly repeats), mip-biased so the ridges stay blurry.
  vec2 w = p + (vec2(nA, nB) - 0.5) * 0.35;
  float r1 = 1.0 - abs(2.0 * texture2D(uNoise, rot(0.6) * w * 3.1 + vec2(0.13, 0.71), 1.0).r - 1.0);
  float r2 = 1.0 - abs(2.0 * texture2D(uNoise, rot(-1.1) * w * 7.3 + vec2(0.52, 0.08), 0.5).r - 1.0);
  float ferns = (pow(r1, 4.0) * 0.6 + pow(r2, 6.0) * 0.4) * (0.5 + nB);

  // Sparse, faint glints on the crystals.
  float glint = smoothstep(0.86, 0.95, texture2D(uNoise, rot(0.3) * w * 23.0).r) * ferns;

  // Translucent everywhere: the opacity at the frame rises with the amount
  // and thins out towards the front.
  float peak = mix(0.18, 0.55, uAmount);
  float alpha = mask * peak * (0.3 + 0.7 * depth) * (0.75 + 0.5 * ferns);
  vec3 color = uTint * (0.85 + 0.25 * ferns) + glint * 0.25;

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;
