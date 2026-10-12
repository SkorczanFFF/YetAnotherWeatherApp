// Frosted glass: ice creeping in from the frame and corners of the "window".
// uAmount (0..1) is how far it has grown, not just how opaque it is: at low
// amounts only the corners and a thin rim are frosted, at 1 (−20 °C) most of
// the pane is iced and only a ragged clear patch stays in the middle. The jagged front, feathery
// fern crystals and glints all come from the shared tileable FBM texture, so
// it costs a handful of texture reads per pixel and nothing outside the frost.

export const FROST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

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

void main() {
  // Work in units of the shorter screen side so the frost isn't stretched.
  vec2 size = uAspect >= 1.0 ? vec2(uAspect, 1.0) : vec2(1.0, 1.0 / uAspect);
  vec2 p = vUv * size;
  vec2 e = min(p, size - p);
  // Harmonic mean of the edge distances: corners frost first, mid-edges later.
  float d = 2.0 * e.x * e.y / (e.x + e.y + 1e-4);

  float reach = uAmount * 0.42;
  float nA = texture2D(uNoise, p * 1.3).r;
  float nB = texture2D(uNoise, p * 4.1 + 0.37).r;
  float front = reach * (0.45 + 1.1 * (nA * 0.65 + nB * 0.35));
  float mask = 1.0 - smoothstep(front - 0.035, front + 0.01, d);
  if (mask < 0.004) discard;

  // 0 at the growth front, 1 at the frame — older ice is thicker.
  float depth = clamp((front - d) / max(front, 1e-3), 0.0, 1.0);

  // Feathery ferns: ridged noise at incommensurate scales and orientations,
  // on domain-warped coordinates so the 256² noise tile never visibly repeats.
  vec2 w = p + (vec2(nA, nB) - 0.5) * 0.35;
  float r1 = 1.0 - abs(2.0 * texture2D(uNoise, rot(0.6) * w * 5.3 + vec2(0.13, 0.71)).r - 1.0);
  float r2 = 1.0 - abs(2.0 * texture2D(uNoise, rot(-1.1) * w * 12.7 + vec2(0.52, 0.08)).r - 1.0);
  float ferns = (pow(r1, 6.0) * 0.75 + pow(r2, 10.0) * 0.55) * (0.35 + 1.1 * nB);

  // Glints on the crystal edges.
  float glint = smoothstep(0.83, 0.9, texture2D(uNoise, rot(0.3) * w * 41.3).r) * ferns;

  float alpha = mask * clamp(0.16 + 0.5 * depth + 0.45 * ferns, 0.0, 1.0);
  alpha *= 0.32 + 0.56 * smoothstep(0.0, 0.6, uAmount);
  vec3 color = uTint * (0.8 + 0.35 * ferns) + glint * 0.5;

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;
