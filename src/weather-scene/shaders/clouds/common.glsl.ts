// Helpers shared by the cloud march and resolve passes.

/** Which pixel of each 2×2 block is marched on a given frame. */
export const BLOCK_OFFSET = /* glsl */ `
ivec2 blockOffset(float frame) {
  int k = int(mod(frame, 4.0));
  // Diagonal first, so two consecutive frames already cover both diagonals.
  return k == 0 ? ivec2(0, 0) : k == 1 ? ivec2(1, 1) : k == 2 ? ivec2(1, 0) : ivec2(0, 1);
}
`;

/** World ray direction for a UV of the full cloud target (needs uInvProj, uCamWorld). */
export const VIEW_RAY = /* glsl */ `
vec3 viewRay(vec2 uv) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  return normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
}
`;
