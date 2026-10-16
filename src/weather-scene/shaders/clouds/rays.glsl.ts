// God rays: a radial march from each pixel towards the on-screen sun over the
// resolved clouds' transmittance (Mitchell, GPU Gems 3 ch. 13). The source is
// open sky near the disc, so gaps by the sun cast streaks outwards and the
// clouds' shadows cut dark lanes between them. Half × half target, like the march.

import { MAX_RAY_SAMPLES } from "../../core/quality";
import { IGN } from "../chunks.glsl";

export const CLOUD_RAYS_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uClouds;    // resolved cloud target, a = 1 − transmittance
uniform vec2 uSunUv;          // on-screen sun; may lie off the frame
uniform float uAspect;        // width / height
uniform float uHorizonV;      // screen v of the horizon — the ground occludes below
uniform int uSamples;

varying vec2 vUv;

const float RAY_REACH = 0.9;      // share of the way to the sun the march covers
const float DECAY = 0.97;         // per sample, away from the pixel
const float GLOW_FALLOFF = 4.0;   // per frame height — how far from the disc the sky lights the air
// A cloud covers a short stretch of the path to the sun, so the raw clear
// share barely dips in its shadow; raising it to this power deepens the lanes.
const float SHAFT_CONTRAST = 2.0;
// Shadow lanes show where the air itself is lit: this pixel's distance from
// the disc (per frame height), wider than the glow so the lanes reach out.
const float SHADOW_FALLOFF = 2.5;
// Only thick cloud casts a shaft's shadow: a cirrus veil (alpha ~0.35–0.65)
// counted in full dimmed the whole sky instead of cutting lanes.
const vec2 OCCLUDER = vec2(0.5, 0.9);
// An open sun gives more glare than shafts (they peak when it hides behind a
// cloud): the added light scales from this up to 1 with the disc's cover.
const float OPEN_SUN = 0.15;
const float DISC_TAP = 0.02;      // frame heights — taps around the disc for its cover
// The sky by the disc is already bright: added light fades in out to here
// (frame heights) instead of piling onto it — a shorter ramp drew a dim ring
// round the disc. Shadow lanes start a little out too: right by the disc a
// small cloud cut dark blades into the glare.
const vec2 SHAFT_START = vec2(0.0, 0.35);
const vec2 SHADOW_START = vec2(0.03, 0.2);

${IGN}

// Light the sun puts into the air at this point of the frame, before clouds.
float glow(vec2 uv, float falloff) {
  float sky = smoothstep(uHorizonV - 0.01, uHorizonV + 0.02, uv.y);
  float d = length((uv - uSunUv) * vec2(uAspect, 1.0));
  return sky * exp(-d * falloff);
}

void main() {
  vec2 stepUv = (uSunUv - vUv) * (RAY_REACH / float(uSamples));
  // Fixed per-pixel jitter (no history here): smooth after the bilinear upsample.
  vec2 uv = vUv + stepUv * ign(gl_FragCoord.xy);
  float lit = 0.0;
  float open = 0.0;
  float norm = 0.0;
  float w = 1.0;
  for (int i = 0; i < ${MAX_RAY_SAMPLES}; i++) {
    if (i >= uSamples) break;
    float g = glow(uv, GLOW_FALLOFF) * w;
    lit += g * (1.0 - smoothstep(OCCLUDER.x, OCCLUDER.y, texture2D(uClouds, uv).a));
    open += g;
    norm += w;
    w *= DECAY;
    uv += stepUv;
  }
  float clearShare = lit / max(open, 1e-5);
  vec2 tap = vec2(DISC_TAP / uAspect, DISC_TAP);
  float hidden = (texture2D(uClouds, clamp(uSunUv, 0.0, 1.0)).a
    + texture2D(uClouds, clamp(uSunUv + vec2(tap.x, 0.0), 0.0, 1.0)).a
    + texture2D(uClouds, clamp(uSunUv - vec2(tap.x, 0.0), 0.0, 1.0)).a
    + texture2D(uClouds, clamp(uSunUv + vec2(0.0, tap.y), 0.0, 1.0)).a
    + texture2D(uClouds, clamp(uSunUv - vec2(0.0, tap.y), 0.0, 1.0)).a) * 0.2;
  float d = length((vUv - uSunUv) * vec2(uAspect, 1.0));
  float shaft = pow(clearShare, SHAFT_CONTRAST);
  // r: light added along the lit lanes; g: how much the clouds' shadows dim
  // the bright air round the sun (the lanes that make shafts read at all).
  gl_FragColor = vec4(
    open / norm * shaft * mix(OPEN_SUN, 1.0, hidden) * smoothstep(SHAFT_START.x, SHAFT_START.y, d),
    glow(vUv, SHADOW_FALLOFF) * (1.0 - shaft) * smoothstep(SHADOW_START.x, SHADOW_START.y, d),
    0.0, 1.0);
}
`;
