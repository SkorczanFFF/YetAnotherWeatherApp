// Temporal resolve: history is reprojected by view direction (the camera only
// rotates a little) and clipped to the variance of the freshly marched
// neighbourhood, so moving or morphing clouds don't leave ghosts; the march
// is upsampled into it.

import { BLOCK_OFFSET, VIEW_RAY } from "./common.glsl";

export const CLOUD_RESOLVE_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uMarch;     // this frame's march, half × half
uniform sampler2D uHistory;   // last resolved frame, full
uniform float uHistoryValid;
uniform float uFrame;
uniform vec2 uMarchSize;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform mat4 uPrevViewProj;   // previous frame, for reprojecting history

varying vec2 vUv;

${BLOCK_OFFSET}
${VIEW_RAY}

// How far history may stray outside the fresh neighbourhood's spread, in
// standard deviations: lower ghosts less but lets the jitter noise through.
const float CLIP_GAMMA = 1.5;
// Blend towards this frame: a freshly marched pixel brings real information,
// elsewhere the upsampled march only nudges the history.
const float ALPHA_MARCHED = 0.3;
const float ALPHA_UPSAMPLED = 0.06;

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  ivec2 off = blockOffset(uFrame);
  // March texel b holds full pixel 2b + off.
  vec2 m = vec2(px - off) * 0.5;
  vec4 current = texture2D(uMarch, (m + 0.5) / uMarchSize);
  bool marched = all(equal((px - off) & 1, ivec2(0)));

  // Clouds are effectively at infinity, so reprojecting by direction alone is
  // exact enough — this keeps history valid while the parallax rig rotates.
  vec4 prevClip = uPrevViewProj * vec4(viewRay(vUv), 0.0);
  vec2 prevUv = prevClip.xy / prevClip.w * 0.5 + 0.5;
  bool inside = prevClip.w > 0.0 && all(greaterThanEqual(prevUv, vec2(0.0))) && all(lessThanEqual(prevUv, vec2(1.0)));
  if (uHistoryValid < 0.5 || !inside) {
    gl_FragColor = current;
    return;
  }

  // Variance clipping against the 3×3 freshly marched texels around us:
  // drifting, morphing or newly revealed clouds can't leave ghosts behind.
  ivec2 last = ivec2(uMarchSize) - 1;
  ivec2 centre = clamp(ivec2(floor(m + 0.5)), ivec2(0), last);
  vec4 mean = vec4(0.0);
  vec4 sq = vec4(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec4 c = texelFetch(uMarch, clamp(centre + ivec2(x, y), ivec2(0), last), 0);
      mean += c;
      sq += c * c;
    }
  }
  mean /= 9.0;
  vec4 spread = CLIP_GAMMA * sqrt(max(sq / 9.0 - mean * mean, 0.0));
  vec4 lo = min(mean - spread, current);
  vec4 hi = max(mean + spread, current);

  vec4 history = clamp(texture2D(uHistory, prevUv), lo, hi);
  gl_FragColor = mix(history, current, marched ? ALPHA_MARCHED : ALPHA_UPSAMPLED);
}
`;
