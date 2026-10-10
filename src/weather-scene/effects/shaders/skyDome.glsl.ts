// Sky-dome gradient shader. Fullscreen clip-space quad with a vertical
// gradient from uHorizon (bottom) to uZenith (top). Interpolation is
// smoothstep-based so the centre region blends rather than showing a hard
// midline. uFlash modulates brightness for <ThunderEffect>.

export const SKY_DOME_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Emit directly in clip space — this is a fullscreen quad, not a mesh
  // that participates in the depth / camera pipeline.
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const SKY_DOME_FRAG = /* glsl */ `
precision highp float;

uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uFlash; // 0 = normal, 1 = full lightning pop

varying vec2 vUv;

void main() {
  // vUv.y = 0 is bottom (horizon), 1 is top (zenith). Bias the midpoint
  // down slightly so the darker zenith colour gets more real estate, which
  // reads as a more natural sky.
  float t = smoothstep(0.0, 1.0, vUv.y * 1.1 - 0.05);
  vec3 color = mix(uHorizon, uZenith, t);

  // Thunder pulse: lerp toward near-white. The effect component drives
  // uFlash to 1 for ~120 ms then decays exponentially.
  color = mix(color, vec3(0.92, 0.94, 1.0), uFlash);

  gl_FragColor = vec4(color, 1.0);
}
`;
