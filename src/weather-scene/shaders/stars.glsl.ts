// Star points. Screen-space size by magnitude, gentle twinkle, round soft
// dots via gl_PointCoord. One uniform fades the whole field (drei <Stars>
// has no continuous opacity — that's why this exists).

export const STARS_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uPixelRatio;
uniform float uTime;
varying float vTwinkle;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uPixelRatio;
  vTwinkle = 0.75 + 0.25 * sin(uTime * (1.3 + aPhase * 2.0) + aPhase * 40.0);
}
`;

export const STARS_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vTwinkle;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * uOpacity * vTwinkle;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), a);
}
`;
