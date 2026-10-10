// Cloud layer shader. Fullscreen clip-space quad. Samples the pre-baked
// FBM noise texture at two octaves with wind-driven UV offsets, then
// branches on uMode:
//   0 (cumulus) — sharp puffy threshold, cloudCover controls how much
//                 of the sky is filled by discrete blobs
//   1 (stratus) — soft blanket, cloudCover drives uniform alpha
//
// Cloud colour comes from the scene's phase palette; at dusk/dawn the
// cumulus puffs pick up a warm tint from the SkyDome horizon via uTint.

export const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Clip-space quad — the plane covers the whole frame regardless of
  // camera position/rotation. Parallax is handled by the CameraRig
  // moving the whole scene's view, not this plane.
  gl_Position = vec4(position.xy, 0.99, 1.0);
}
`;

export const CLOUD_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uNoise;
uniform float uCover;     // 0..1
uniform vec3 uTint;
uniform vec2 uWindUV;     // accumulated wind offset
uniform float uMode;      // 0 = cumulus, 1 = stratus
uniform float uAspect;    // viewport aspect (w/h) so clouds don't stretch
uniform float uAltitude;  // 0..1 — bias alpha toward upper sky

varying vec2 vUv;

void main() {
  // Correct for aspect so the noise stays roughly isotropic.
  vec2 uv = vec2(vUv.x * uAspect, vUv.y);

  // Two-scale sampling smooths any residual seam in the baked texture
  // and adds variation across scales.
  vec2 uv1 = uv * 1.4 + uWindUV;
  vec2 uv2 = uv * 3.1 + uWindUV * 1.8;
  float n1 = texture2D(uNoise, uv1).r;
  float n2 = texture2D(uNoise, uv2).r;
  float n = n1 * 0.65 + n2 * 0.35;

  float alpha;
  if (uMode < 0.5) {
    // CUMULUS — threshold shrinks as cover grows; puffs get larger + more
    // numerous. Edges stay soft over a ~0.15 band so the transition reads
    // like fluffy cloud.
    float threshold = 1.0 - uCover * 0.85;
    alpha = smoothstep(threshold, threshold - 0.14, n);
  } else {
    // STRATUS — flat blanket. Base alpha from cover with soft noise
    // modulation so it doesn't look like a uniform fill.
    float base = clamp((uCover - 0.3) * 1.45, 0.0, 1.0);
    float modulation = smoothstep(0.25, 0.75, n);
    alpha = base * (0.7 + 0.3 * modulation);
  }

  // Altitude fade — push clouds toward the upper half of the sky. A pure
  // flat layer at y=0.5 (sky midline) looks wrong because real clouds
  // taper toward horizon with perspective. This isn't true perspective
  // but reads close enough.
  float altitudeGate = smoothstep(0.2, 0.6, vUv.y);
  alpha *= mix(altitudeGate, 1.0, uAltitude * 0.4);

  gl_FragColor = vec4(uTint, clamp(alpha, 0.0, 1.0));
}
`;
