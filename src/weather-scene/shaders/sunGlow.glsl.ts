// Sun glow: a billboard around the displayed sun, additive and not tone-mapped.
// Preetham's disc tone-maps to a flat white dot that doesn't read as a light
// source; a bright rim hugging the disc plus a wide halo of lit air does.
// Drawn under the cloud composite, so clouds in front hide it. Display-space
// colour, never sRGB-encoded: the encoding's toe lifted the faint halo ×10
// into a white blob the size of a fist.

export const SUN_GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SUN_GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;      // display space, × strength
uniform float uSpread;    // rim + halo gain: low with a high sun, whose sky is already near white
uniform float uHalfDeg;   // half-size of the quad, degrees
uniform float uDiscDeg;   // the sky's disc radius, degrees

varying vec2 vUv;

void main() {
  float r = length(vUv - 0.5) * 2.0 * uHalfDeg;   // degrees from the centre
  float core = 1.0 - smoothstep(uDiscDeg * 0.5, uDiscDeg * 1.1, r);
  // Next to the disc the sky is already bright: the rim and halo must stay
  // under white there, or the disc loses its edge in a blob.
  float rim = exp(-max(r - uDiscDeg, 0.0) / 1.1);
  float halo = exp(-r / 5.0) * (1.0 - smoothstep(uHalfDeg * 0.6, uHalfDeg, r));
  gl_FragColor = vec4(uColor * (core * 0.35 + (rim * 0.15 + halo * 0.07) * uSpread), 1.0);
}
`;
