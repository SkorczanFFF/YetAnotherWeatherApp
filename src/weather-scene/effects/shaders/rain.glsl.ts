// Rain particle shader. Each particle is a Point rendered as a short
// vertical streak — gl_PointSize scales with distance, the fragment
// shader paints a thin vertical gradient inside the sprite area.

export const RAIN_VERT = /* glsl */ `
attribute float aSize;
uniform float uPixelRatio;
varying float vAlpha;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  // Size attenuated by depth so distant drops stay visible but small.
  gl_PointSize = aSize * uPixelRatio * (10.0 / -mvPosition.z);
  // Fade drops that spawn close to the camera (avoids "popping" in).
  vAlpha = clamp((-mvPosition.z - 2.0) / 4.0, 0.0, 1.0);
}
`;

export const RAIN_FRAG = /* glsl */ `
precision mediump float;

uniform vec3 uColor;
varying float vAlpha;

void main() {
  // gl_PointCoord: 0,0 = top-left, 1,1 = bottom-right.
  vec2 uv = gl_PointCoord - 0.5;
  // Thin vertical streak: alpha peaks along x=0, fades out horizontally.
  float core = 1.0 - smoothstep(0.0, 0.18, abs(uv.x));
  // Fade top + bottom of streak so it doesn't read as a rectangle.
  float fade = 1.0 - smoothstep(0.35, 0.5, abs(uv.y));
  float a = core * fade * vAlpha * 0.6;
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a);
}
`;
