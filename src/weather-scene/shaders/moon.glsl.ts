// Moon disc. The quad is treated as the visible hemisphere of a sphere:
// the equirectangular moon.jpg is sampled by the sphere normal, and the
// terminator comes from the suncalc phase. The light direction is projected
// from the on-screen sun so the bright limb points at the sun shown in the
// scene. Additive — only lit surface brightens the sky, like the real thing.

export const MOON_FRAG = /* glsl */ `
#define PI 3.141592653589793
uniform sampler2D uMap;
/** Screen-space direction from the moon towards the sun. */
uniform vec2 uSunDir2D;
/** suncalc phase × 2π (0 new, π full). */
uniform float uPhaseAngle;
uniform float uOpacity;
uniform vec3 uTint;

varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  vec3 n = vec3(p, sqrt(1.0 - r2));

  vec2 uv = vec2(atan(n.x, n.z) / (2.0 * PI) + 0.5, asin(n.y) / PI + 0.5);
  vec3 albedo = texture2D(uMap, uv).rgb;

  // New moon: light from behind (-z). Full: from the viewer (+z).
  vec3 L = normalize(vec3(uSunDir2D * abs(sin(uPhaseAngle)), -cos(uPhaseAngle)));
  float lit = smoothstep(-0.04, 0.12, dot(n, L));
  float earthshine = 0.035;

  float edge = 1.0 - smoothstep(0.96, 1.0, r2);
  vec3 color = albedo * uTint * (earthshine + (1.0 - earthshine) * lit);
  gl_FragColor = vec4(color * edge * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;
