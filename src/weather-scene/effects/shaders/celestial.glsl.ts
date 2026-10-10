// Sun / moon disc shader. Radial gradient with a bright core and a soft
// halo falloff. Alpha goes to 0 before the UV reaches the plane edge so
// the disc reads as round even without antialiasing.

export const CELESTIAL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CELESTIAL_FRAG = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uIntensity; // 1 = normal, <1 = dim (e.g. moon), >1 = bloom-ish
uniform float uHaloSize;  // 0.4..0.9 — how far the glow extends

varying vec2 vUv;

void main() {
  float d = distance(vUv, vec2(0.5));
  // Hard disc core at d < 0.22, then soft halo out to uHaloSize.
  float core = smoothstep(0.24, 0.18, d);
  float halo = smoothstep(uHaloSize, 0.22, d);
  float alpha = clamp(core + halo * 0.55, 0.0, 1.0);
  vec3 color = uColor * uIntensity;
  // Give the halo a slight warm tint bleed so the disc centre looks
  // brighter than the surround.
  color = mix(color * 0.85, color * 1.15, core);
  gl_FragColor = vec4(color, alpha);
}
`;
