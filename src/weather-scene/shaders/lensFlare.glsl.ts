// Lens flare: what a camera lens adds around a bright source — ghosts of the
// aperture strung along the line from the source through the frame's centre,
// a faint rainbow ring and diffraction spikes at the source. One full-screen
// pass, additive in display space (never sRGB-encoded: the encoding's toe
// would lift every faint ghost). Clouds over the source put it out: the
// vertex shader reads the cloud cover around the source once per vertex.

export const LENS_FLARE_VERT = /* glsl */ `
uniform sampler2D uClouds;
uniform float uCloudsOn;
uniform vec2 uSource;    // source uv; may lie off the frame
uniform vec2 uTap;       // cloud-cover tap spacing, uv

varying vec2 vUv;
varying float vClear;

float cover(vec2 uv) {
  return textureLod(uClouds, clamp(uv, 0.0, 1.0), 0.0).a;
}

void main() {
  vUv = uv;
  float c = (cover(uSource) * 2.0
    + cover(uSource + vec2(uTap.x, 0.0)) + cover(uSource - vec2(uTap.x, 0.0))
    + cover(uSource + vec2(0.0, uTap.y)) + cover(uSource - vec2(0.0, uTap.y))) / 6.0;
  // A thin veil still lets a flare through; a cloud's body doesn't.
  vClear = 1.0 - uCloudsOn * smoothstep(0.15, 0.75, c);
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const LENS_FLARE_FRAG = /* glsl */ `
uniform vec2 uSource;
uniform float uAspect;
uniform vec3 uColor;     // display space, × strength
uniform float uSpikes;   // diffraction spikes gain (the sun; ~0 for the moon)

varying vec2 vUv;
varying float vClear;

// Ghost centres along the axis, as a share of the source's offset from the
// centre (1 = the source, −1 = mirrored through the centre), radius, tint.
const int GHOSTS = 6;
const float AT[6] = float[](0.55, 0.22, -0.18, -0.42, -0.7, -1.05);
const float RADIUS[6] = float[](0.028, 0.05, 0.022, 0.075, 0.04, 0.12);
const vec3 TINT[6] = vec3[](
  vec3(1.0, 0.85, 0.55), vec3(0.55, 0.9, 0.75), vec3(0.85, 0.6, 1.0),
  vec3(0.5, 0.75, 1.0), vec3(1.0, 0.7, 0.5), vec3(0.6, 0.85, 1.0)
);
const float GAIN[6] = float[](0.6, 0.35, 0.7, 0.3, 0.45, 0.22);

// Hexagonal aperture distance (pointy-top), 1 at the edge.
float hexDist(vec2 p) {
  p = abs(p);
  return max(p.x * 0.866025 + p.y * 0.5, p.y);
}

void main() {
  vec2 aspect = vec2(uAspect, 1.0);
  vec2 p = (vUv - 0.5) * aspect;
  vec2 s = (uSource - 0.5) * aspect;
  vec3 col = vec3(0.0);

  for (int i = 0; i < GHOSTS; i++) {
    vec2 d = (p - s * AT[i]) / RADIUS[i];
    // Odd ghosts carry the aperture's hexagon; a bright rim, a softer fill.
    float r = (i % 2 == 1) ? hexDist(d) : length(d);
    float shape = (1.0 - smoothstep(0.82, 1.0, r)) * (0.45 + 0.55 * smoothstep(0.55, 0.98, r));
    col += TINT[i] * shape * GAIN[i];
  }
  // Ghosts dim as the source nears the centre (the axis collapses) — as in a lens.
  col *= smoothstep(0.0, 0.2, length(s));

  // Faint rainbow ring round the source.
  float ds = length(p - s);
  float ring = exp(-pow((ds - 0.42) / 0.035, 2.0));
  col += mix(vec3(1.0, 0.45, 0.35), vec3(0.4, 0.6, 1.0), smoothstep(0.38, 0.46, ds)) * ring * 0.16;

  // Diffraction spikes: six thin rays from the source, fading fast.
  float ang = atan(p.y - s.y, p.x - s.x);
  float spikes = pow(abs(cos(ang * 3.0)), 60.0) * exp(-ds * 12.0) * uSpikes;
  col += vec3(1.0, 0.95, 0.85) * spikes * 0.75;

  gl_FragColor = vec4(col * uColor * vClear, 1.0);
}
`;
