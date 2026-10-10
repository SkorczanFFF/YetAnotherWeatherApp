// Snow particle shader. Textured points — each particle draws the
// snowflake atlas in gl_PointCoord. Per-particle phase offset drives a
// gentle horizontal sway so flakes don't fall dead-vertical.

export const SNOW_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase; // 0..1, per-flake sway offset
uniform float uPixelRatio;
uniform float uTime;
varying float vAlpha;

void main() {
  vec3 pos = position;
  // Sway: horizontal sine wobble around the particle's column.
  pos.x += sin(uTime * 0.6 + aPhase * 6.28) * 0.18;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uPixelRatio * (14.0 / -mvPosition.z);
  vAlpha = clamp((-mvPosition.z - 2.0) / 4.0, 0.0, 1.0);
}
`;

export const SNOW_FRAG = /* glsl */ `
precision mediump float;

uniform sampler2D uTex;
uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec4 c = texture2D(uTex, gl_PointCoord);
  float a = c.a * vAlpha;
  if (a < 0.05) discard;
  gl_FragColor = vec4(uColor * c.rgb, a);
}
`;
