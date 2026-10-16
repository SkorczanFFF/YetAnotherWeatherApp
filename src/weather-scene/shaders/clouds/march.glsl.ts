// Volumetric clouds — Nubis-style (Schneider, Horizon Zero Dawn) raymarch
// through a spherical shell above a curved Earth, in metres
// (see CLAUDE.md › Volumetric clouds).
//
// Four passes per frame, all at a fraction of the canvas:
//   1. CLOUD_MARCH_FRAG (here) marches a half × half target: each texel is the
//      one pixel of its 2×2 block whose turn it is this frame (fresh jitter),
//      so the per-frame cost is ~1/4 of the cloud target.
//   2. CLOUD_RESOLVE_FRAG (resolve.glsl) rebuilds the full cloud target from
//      the reprojected, variance-clipped history and the upsampled march.
//   3. CLOUD_RAYS_FRAG (rays.glsl), with the sun up near the frame, radially
//      blurs the open sky by the sun into god rays, half × half.
//   4. CLOUD_COMPOSITE_FRAG (composite.glsl) tone-maps the clouds over the sky, adds the rays.
//
// Cloud output is premultiplied: rgb = in-scattered radiance (pre-tonemap,
// "sky units"), a = 1 − transmittance.

import { EARTH_RADIUS_M } from "../../core/worldFrame";
import { CLOUD_LIGHTNING } from "../../core/palette";
import { CIRRUS_ALPHA, FBM_WEIGHTS, glslColor, IGN, NOISE_RANK, REMAP } from "../chunks.glsl";
import { BLOCK_OFFSET, VIEW_RAY } from "./common.glsl";
import { CLOUD_DENSITY } from "./density.glsl";
import { CLOUD_LAYERS, LAYER_MIN } from "./layers.glsl";
import { CLOUD_LIGHTING } from "./lighting.glsl";

export const CLOUD_MARCH_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler3D uNoise;
uniform float uFrame;
uniform vec2 uFullSize;      // full cloud target, px

uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;        // metres

const float EARTH_R = ${EARTH_RADIUS_M}.0;   // m
uniform float uBase;         // cloud base altitude, m
uniform float uThickness;    // shell thickness, m
uniform float uCoverage;     // 0..1
uniform float uType;         // 0 stratus · 0.3 altocumulus · 0.5 cumulus · 1 cumulonimbus
uniform float uDensity;      // extinction per metre at density 1
uniform float uDeckTau;      // optical depth of the whole deck
uniform float uFeatureScale; // noise size multiplier, ≤ 1 — a low deck gets smaller cells
// Accumulated drifts, wrapped by the tiles of the lookups that read them (cloudDrift.ts):
uniform vec2 uWind;          // low/mid layer (850 hPa), noise space (xz) — cover and shape
uniform vec2 uWindDetail;    // the same, for the detail noise
uniform vec2 uMidDrift;      // thin mid layer, half the 300 hPa drift, m (xz)
uniform vec4 uCirrusDrift;   // cirrus (300 hPa), in tiles of its two lookups
uniform vec2 uHighWindDir;   // unit, xz — cirrus streaks stretch along it
uniform float uCirrusAlt;    // m above ground
uniform float uFreezeAlt;    // 0 °C level above ground, m — ice above it
uniform float uEvolve;       // slow morphing offset
uniform float uHigh;         // cirrus cover 0..1
uniform float uMid;          // cover of the thin mid layer above a low deck, 0..1
uniform float uMidAlt;       // its height above ground, m

uniform vec3 uLightDir;      // light march: real altitude
uniform vec3 uPhaseDir;      // phase: on-screen sun/moon, where the silver lining sits
uniform vec3 uLightColor;    // radiance incl. intensity
uniform vec3 uAmbientTop;
uniform vec3 uAmbientBottom;
uniform vec3 uHazeColor;
uniform float uHazeDist;     // e-folding distance of aerial perspective, m
uniform float uMaxDist;
uniform int uSteps;
uniform int uLightSteps;

uniform float uFlash;
uniform vec3 uFlashPos;      // metres

${BLOCK_OFFSET}
${VIEW_RAY}
${REMAP}
${NOISE_RANK}
${FBM_WEIGHTS}
${CIRRUS_ALPHA}
${IGN}
${CLOUD_DENSITY}
${CLOUD_LIGHTING}
${CLOUD_LAYERS}

// Adaptive march: cheap 3× steps (no detail, no lighting) through empty air,
// back up one and go fine on a hit; the fine step grows with distance (a far
// sample covers more per pixel). uSteps caps the lit samples, not the iterations.
const int MAX_ITERATIONS = 192;
const float STEP_PER_METRE = 0.02;   // fine step ≈ 2 % of the distance…
const float MAX_STEP = 900.0;        // …up to this, m
const float CHEAP_FACTOR = 3.0;
const int EMPTY_TO_CHEAP = 3;

float fineStep(float t, float minStep) {
  return clamp(t * STEP_PER_METRE, minStep, max(minStep, MAX_STEP));
}

vec4 march(vec3 ro, vec3 rd, float jitter) {
  // Below the horizon: the ground is in the way.
  if (raySphere(ro, rd, EARTH_R).x > 0.0) return vec4(0.0, 0.0, 0.0, 0.0);

  float tStart = raySphere(ro, rd, EARTH_R + uBase).y;
  float tEnd = min(raySphere(ro, rd, EARTH_R + uBase + uThickness).y, uMaxDist);

  vec3 scat = vec3(0.0);
  float T = 1.0;
  float tFirst = -1.0;
  float cosTheta = dot(rd, uPhaseDir);

  if (tStart < tEnd) {
    float minStep = max(25.0, uThickness / float(uSteps));
    float t = tStart + fineStep(tStart, minStep) * jitter;
    bool cheap = true;
    float tHit = 0.0;
    int empty = 0;
    int lit = 0;
    for (int i = 0; i < MAX_ITERATIONS; i++) {
      if (t >= tEnd || lit >= uSteps) break;
      float dt = fineStep(t, minStep);
      vec3 p = ro + rd * t;
      float hf = heightFraction(p);

      if (cheap) {
        if (density(p, hf, false) > 0.0) {
          // Something is here: back up and walk in with fine steps.
          cheap = false;
          empty = 0;
          tHit = t;
          t = max(tStart, t - dt * CHEAP_FACTOR);
        } else {
          t += dt * CHEAP_FACTOR;
        }
        continue;
      }

      float column;
      float d = density(p, hf, true, column);
      if (d > 0.002) {
        empty = 0;
        lit++;
        if (tFirst < 0.0) tFirst = t;
        float sigma = d * uDensity;
        float od = lightOpticalDepth(p, fract(jitter + float(lit) * 0.618034));
        // Denser pockets are darker — gives a closed deck its mottled base.
        vec3 ambient = mix(uAmbientBottom, uAmbientTop, smoothstep(0.0, 0.9, hf)) * mix(1.15, 0.7, d);
        vec3 L = uLightColor * max(sunEnergy(od, cosTheta), diffuseLight(od, hf, column)) + ambient;
        // Lightning lights the cloud from inside.
        L += ${glslColor(CLOUD_LIGHTNING)} * uFlash * 6.0 * exp(-distance(p, uFlashPos) / 1800.0);
        float tr = exp(-sigma * dt);
        scat += T * L * (1.0 - tr);
        T *= tr;
        if (T < 0.015) break;
      } else if (++empty >= EMPTY_TO_CHEAP && t > tHit) {
        // Only past the hit that sent us here — or a cloud whose detail
        // erodes to nothing would bounce between the two modes forever.
        cheap = true;
      }
      t += dt;
    }
  }

  if (tFirst > 0.0) {
    // Aerial perspective: distant clouds sink into the horizon haze.
    float fog = aerial(tFirst, 1.0);
    scat = mix(scat, uHazeColor * (1.0 - T), fog);
    float edge = smoothstep(uMaxDist * 0.45, uMaxDist, tFirst);
    scat *= 1.0 - edge;
    T = mix(T, 1.0, edge);
  }

  // The 2D sheets lie behind the volume, nearest first.
  if (uMid > ${LAYER_MIN} && T > 0.02) midLayer(ro, rd, cosTheta, scat, T);
  if (uHigh > ${LAYER_MIN} && T > 0.02) cirrusLayer(ro, rd, cosTheta, scat, T);

  return vec4(scat, 1.0 - T);
}

void main() {
  // This texel stands for one pixel of its 2×2 block of the full target.
  ivec2 b = ivec2(gl_FragCoord.xy);
  ivec2 px = b * 2 + blockOffset(uFrame);
  vec3 rd = viewRay((vec2(px) + 0.5) / uFullSize);
  // Interleaved gradient noise across the march texels, rotated by the golden
  // ratio each time this pixel's turn comes round: stratified in space and time.
  float jitter = fract(ign(vec2(b)) + floor(uFrame / 4.0) * 0.618034);
  gl_FragColor = march(uCamPos, rd, jitter);
}
`;
