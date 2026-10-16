// Full-screen composite in the main scene: the resolved clouds over the sky,
// plus the god rays and their shadow lanes.

export const CLOUD_COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D uClouds;
uniform sampler2D uRays;
uniform vec3 uRayColor;       // display space, × strength (black = no shafts)
uniform float uRayShadow;     // × strength (0 = no shafts)
uniform vec2 uRayTexel;       // 1 / rays target size
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uClouds, vUv);
  float a = c.a;
  // Shafts are lit air in front of the sky and, more faintly, of the clouds.
  // Soft cap: faint shafts keep their slope, bright ones saturate at RAY_MAX
  // instead of whiting out the sky they cross.
  const float RAY_MAX = 0.35;
  // Shadow lanes dim the sky behind (not the clouds casting them) through the
  // output alpha, at most by SHADOW_MAX.
  const float SHADOW_MAX = 0.25;
  // 4 bilinear taps half a texel out: a tent over the rays target that hides
  // the march's per-pixel jitter (a dot pattern once the lanes got contrast).
  vec2 o = 0.5 * uRayTexel;
  vec2 shaft = 0.25 * (texture2D(uRays, vUv + vec2(-o.x, -o.y)).rg + texture2D(uRays, vUv + vec2(o.x, -o.y)).rg
    + texture2D(uRays, vUv + vec2(-o.x, o.y)).rg + texture2D(uRays, vUv + o).rg);
  vec3 rays = RAY_MAX * (1.0 - exp(-uRayColor * shaft.r / RAY_MAX)) * (1.0 - 0.6 * a);
  float shadow = SHADOW_MAX * (1.0 - exp(-uRayShadow * shaft.g / SHADOW_MAX)) * (1.0 - a);
  if (a + shadow < 0.002 && max(rays.r, max(rays.g, rays.b)) < 0.002) discard;
  // Un-premultiply BEFORE tone mapping and sRGB encoding: encoding premultiplied
  // colour inflates thin edges (sRGB's linear toe is ×12.92) into white outlines.
  vec3 cloud = c.rgb / max(a, 1e-4);
  #ifdef TONE_MAPPING
  cloud = toneMapping(cloud);
  #endif
  cloud = linearToOutputTexel(vec4(cloud, 1.0)).rgb;
  // Premultiplied output (blend ONE, ONE_MINUS_SRC_ALPHA): the encoded cloud
  // over the sky exactly as before, plus the shafts added in display space —
  // encoding them would lift every faint value by the sRGB toe — and the
  // shadow lanes taken out of the sky by the extra alpha.
  gl_FragColor = vec4(cloud * a + rays, a + shadow);
}
`;
