// Volumetric clouds — Nubis-style (Schneider, Horizon Zero Dawn) raymarch
// through a spherical shell above a curved Earth, in metres
// (see CLAUDE.md › Volumetric clouds).
//
// Three passes per frame, all at a fraction of the canvas:
//   1. VOLUMETRIC_FRAG marches a half × half target: each texel is the one
//      pixel of its 2×2 block whose turn it is this frame (fresh jitter), so
//      the per-frame cost is ~1/4 of the cloud target.
//   2. CLOUD_RESOLVE_FRAG rebuilds the full cloud target: history is
//      reprojected by view direction (the camera only rotates a little) and
//      clipped to the variance of the freshly marched neighbourhood, so moving
//      or morphing clouds don't leave ghosts; the march is upsampled into it.
//   3. CLOUD_RAYS_FRAG (only with the sun up and gaps to shine through)
//      radially blurs the open sky by the sun into god rays, half × half.
//   4. CLOUD_COMPOSITE_FRAG tone-maps the clouds over the sky, adds the rays.
//
// Cloud output is premultiplied: rgb = in-scattered radiance (pre-tonemap,
// "sky units"), a = 1 − transmittance.

import { MAX_LIGHT_STEPS, MAX_RAY_SAMPLES } from "../core/quality";
import { CIRRUS_ALPHA, FBM_WEIGHTS, NOISE_RANK, REMAP } from "./chunks.glsl";

/** Which pixel of each 2×2 block is marched on a given frame (shared by passes 1 and 2). */
const BLOCK_OFFSET = /* glsl */ `
ivec2 blockOffset(float frame) {
  int k = int(mod(frame, 4.0));
  // Diagonal first, so two consecutive frames already cover both diagonals.
  return k == 0 ? ivec2(0, 0) : k == 1 ? ivec2(1, 1) : k == 2 ? ivec2(1, 0) : ivec2(0, 1);
}
`;

/** World ray direction for a UV of the full cloud target. */
const VIEW_RAY = /* glsl */ `
vec3 viewRay(vec2 uv) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  return normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
}
`;

export const VOLUMETRIC_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler3D uNoise;
uniform float uFrame;
uniform vec2 uFullSize;      // full cloud target, px

uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;        // metres

uniform float uEarthR;
uniform float uBase;         // cloud base altitude, m
uniform float uThickness;    // shell thickness, m
uniform float uCoverage;     // 0..1
uniform float uType;         // 0 stratus · 0.3 altocumulus · 0.5 cumulus · 1 cumulonimbus
uniform float uDensity;      // extinction per metre at density 1
uniform float uDeckTau;      // optical depth of the whole deck
uniform float uFeatureScale; // noise size multiplier, ≤ 1 — a low deck gets smaller cells
uniform vec2 uWind;          // accumulated drift of the low/mid layer (850 hPa), in noise space (xz)
uniform vec2 uWindHigh;      // accumulated drift at cirrus level (300 hPa), m (xz)
uniform vec2 uHighWindDir;   // unit, xz — cirrus streaks stretch along it
uniform float uCirrusAlt;    // m above ground
uniform float uFreezeAlt;    // 0 °C level above ground, m — ice above it
uniform float uEvolve;       // slow morphing offset
uniform float uHigh;         // cirrus cover 0..1

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

varying vec2 vUv;

${BLOCK_OFFSET}
${VIEW_RAY}

const float SHAPE_SCALE = 1.0 / 3200.0;   // one noise tile ≈ 3.2 km
const float DETAIL_SCALE = 1.0 / 520.0;
const float WEATHER_SCALE = 1.0 / 10000.0;

${REMAP}
${NOISE_RANK}
${FBM_WEIGHTS}
${CIRRUS_ALPHA}

// Every noise lookup is explicit-LOD (the 3D noise has no mips, so the values
// are the same): implicit derivatives are undefined inside the march's
// data-dependent loops, and ANGLE's D3D11 backend (Chrome on Windows) returned
// an empty ray wherever the march broke out early — every opaque cloud nearby.
vec4 noise3(vec3 p) {
  return textureLod(uNoise, p, 0.0);
}

// Interleaved gradient noise — cheap per-pixel jitter, decorrelated per frame.
float ign(vec2 p) {
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}

// Ray vs sphere centred at the Earth's centre; returns (near, far) or (-1).
vec2 raySphere(vec3 ro, vec3 rd, float r) {
  vec3 oc = ro + vec3(0.0, uEarthR, 0.0);
  float b = dot(oc, rd);
  float c = dot(oc, oc) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float heightFraction(vec3 p) {
  return (length(p + vec3(0.0, uEarthR, 0.0)) - uEarthR - uBase) / uThickness;
}

// Vertical density profile per cloud type: flat stratus, bottom-heavy
// cumulus (rounded tops once coverage erodes it), tall cumulonimbus.
float heightGradient(float hf) {
  float stratus = smoothstep(0.0, 0.2, hf) * (1.0 - smoothstep(0.5, 0.9, hf));
  float cumulus = smoothstep(0.0, 0.08, hf) * (1.0 - smoothstep(0.25, 0.95, hf));
  float cb = smoothstep(0.0, 0.05, hf) * (1.0 - smoothstep(0.8, 1.0, hf));
  return uType < 0.5
    ? mix(stratus, cumulus, uType * 2.0)
    : mix(cumulus, cb, uType * 2.0 - 1.0);
}

// Measured stats of the near-normal, very narrow noise mixes, so noiseRank()
// gives an even 0..1 rank and cover c keeps exactly c of the area.
// Re-measure if cloudNoise.glsl changes.
const vec2 COVER_NOISE = vec2(0.624, 0.050);   // mean, standard deviation
const vec2 CIRRUS_NOISE = vec2(0.490, 0.081);
const float COVER_EDGE = 0.18;   // half-width of a cell edge, in rank

// Rank (0..1) of the slowly scrolling weather noise; the top uCoverage share is cloud.
float coverRank(vec2 xz, float hf) {
  vec2 q = xz * WEATHER_SCALE;
  // Perlin-Worley + Worley at two scales — irregular cells, not round blobs.
  // Drifting through the third axis with height makes rims lean and bulge
  // instead of extruding into vertical curtains; every slice has the same stats.
  float n = noise3(vec3(q, 0.31 + uEvolve * 0.05 + hf * 0.06)).r * 0.55
          + noise3(vec3(q * 0.43 + 0.29, 0.52 + hf * 0.12)).g * 0.25
          + noise3(vec3(q * 2.3 + 0.17, 0.73 + hf * 0.3)).g * 0.2;
  return noiseRank(n, COVER_NOISE);
}

// Column thickness of a closing deck at the last density() sample, relative
// to the deck's mean (its lumpy-base factor; 1 elsewhere). Read it right after
// the lit sample's density() — the light march below overwrites it.
float gColumn = 1.0;

float density(vec3 p, float hf, bool detail) {
  gColumn = 1.0;
  if (hf < 0.0 || hf > 1.0) return 0.0;
  // Noise space is metres ÷ uFeatureScale, so a low deck keeps cumulus-sized cells
  // on screen. uWind is already in noise space: a changing scale zooms around the camera.
  vec2 xz = p.xz / uFeatureScale - uWind;
  float y = p.y / uFeatureScale;
  float c = uCoverage;
  float rank = coverRank(xz, hf);
  // Deliberately wide edge: the cover falling off at a cell's rim rounds its
  // top; a sharp mask extrudes into vertical walls.
  float cov = smoothstep(1.0 - c - COVER_EDGE, 1.0 - c + COVER_EDGE, rank) * smoothstep(0.0, 0.05, c);
  // Convective towers narrow with height (stacked, rounded tops), so even a
  // tall cumulonimbus isn't its cell's footprint extruded into a column.
  cov *= 1.0 - 0.45 * smoothstep(0.35, 0.9, uType) * smoothstep(0.15, 1.0, hf);
  // Cumulonimbus anvil: near the top each cell spreads into a wider halo of
  // its own — not into the clear air between cells.
  if (uType > 0.9) {
    float halo = smoothstep(1.0 - c - COVER_EDGE - 0.25, 1.0 - c, rank) * smoothstep(0.0, 0.05, c);
    cov = max(cov, smoothstep(0.75, 0.95, hf) * 0.85 * halo);
  }
  cov = clamp(cov + smoothstep(0.85, 1.0, c), 0.0, 1.0);
  if (cov < 0.01) return 0.0;

  vec3 uvw = vec3(xz.x, y + uEvolve * 400.0, xz.y) * SHAPE_SCALE;
  vec4 n = noise3(uvw);
  float lowFbm = dot(n.gba, FBM_WEIGHTS);
  float base = remap(n.r, lowFbm - 1.0, 1.0, 0.0, 1.0);
  base *= heightGradient(hf);
  base = remap(base, 1.0 - cov, 1.0, 0.0, 1.0) * cov;
  // A closed deck still has structure: undulating, lumpy base.
  gColumn = mix(1.0, 0.35 + 1.1 * lowFbm, smoothstep(0.75, 1.0, uCoverage));
  base *= gColumn;
  if (base <= 0.0) return 0.0;

  if (detail) {
    vec3 duvw = vec3(xz.x, y, xz.y) * DETAIL_SCALE + vec3(uEvolve * 2.0);
    vec4 d = noise3(duvw);
    float hfFbm = dot(d.gba, FBM_WEIGHTS);
    // Wispy bottoms, billowy tops; above the freezing level the cloud is
    // glaciated — softer, fibrous edges (anvils, ice tops).
    float altitude = hf * uThickness + uBase;
    float ice = smoothstep(uFreezeAlt, uFreezeAlt + 1500.0, altitude);
    float modifier = mix(hfFbm, 1.0 - hfFbm, clamp(hf * 6.0, 0.0, 1.0) * (1.0 - ice * 0.7));
    base = remap(base, modifier * (0.5 + 0.2 * ice), 1.0, 0.0, 1.0);
  }
  return clamp(base, 0.0, 1.0);
}

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); // ×4π-normalised
}

// Optical depth towards the light, cone-ish growing steps.
float lightOpticalDepth(vec3 p) {
  float stepLen = uThickness * 0.45 / float(uLightSteps);
  float t = 0.0;
  float od = 0.0;
  for (int i = 0; i < ${MAX_LIGHT_STEPS}; i++) {
    if (i >= uLightSteps) break;
    float s = stepLen * (1.0 + float(i) * 0.7);
    t += s;
    vec3 q = p + uLightDir * (t - s * 0.5);
    float hf = heightFraction(q);
    if (hf > 1.0 || hf < 0.0) break;
    od += density(q, hf, i < 2) * s;
  }
  return od * uDensity;
}

// Beer + powder with a 3-octave multiple-scattering approximation (Wrenninge).
float sunEnergy(float od, float cosTheta) {
  float sum = 0.0;
  float a = 1.0;
  float b = 1.0;
  float c = 1.0;
  for (int i = 0; i < 3; i++) {
    // Narrow forward lobe (silver lining only close to the sun), broad main
    // lobe, a little back-scatter.
    float phase = 0.18 * hg(cosTheta, 0.88 * c) + 0.62 * hg(cosTheta, 0.3 * c) + 0.2 * hg(cosTheta, -0.25 * c);
    // Higher orders need medium to scatter in; on thin edges they would draw white outlines.
    float depthWeight = i == 0 ? 1.0 : 1.0 - exp(-od * 1.5);
    sum += a * exp(-od * b) * phase * depthWeight;
    a *= 0.7;
    b *= 0.2;
    c *= 0.5;
  }
  // Powder darkens crevices only when the sun is behind the viewer; looking
  // towards the sun the edges must stay bright (silver lining).
  float powder = 1.0 - exp(-od * 2.0 - 0.05);
  return sum * mix(1.0, powder, 0.5 * (0.5 - 0.5 * cosTheta));
}

// Sunlight diffused down through a thick deck. Two-stream transmission falls
// as 1/τ, the octaves above exponentially — without this floor every overcast
// base went black. Through a horizontal deck light forgets its slant, so the
// depth is the deck's τ above the sample (at most the march's); it needs medium
// to build up (no white rims) and scales with the irradiance of a low sun.
const float TWO_STREAM_K = 0.1125;   // (1 − g)·0.75, g = 0.85
const float DIFFUSE_GAIN = 1.1;
float diffuseLight(float od, float hf, float column) {
  // Thinner patches of a closed deck let more light through: seen from below
  // an overcast is mottled, not one flat grey.
  float tauAbove = min(od, uDeckTau * (1.0 - hf) * column);
  float mu = mix(0.35, 1.0, clamp(uLightDir.y / 0.7, 0.0, 1.0));
  return DIFFUSE_GAIN * mu * (1.0 - exp(-od * 1.5)) / (1.0 + TWO_STREAM_K * tauAbove);
}

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
  if (raySphere(ro, rd, uEarthR).x > 0.0) return vec4(0.0, 0.0, 0.0, 0.0);

  float tStart = raySphere(ro, rd, uEarthR + uBase).y;
  float tEnd = min(raySphere(ro, rd, uEarthR + uBase + uThickness).y, uMaxDist);

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

      float d = density(p, hf, true);
      if (d > 0.002) {
        empty = 0;
        lit++;
        if (tFirst < 0.0) tFirst = t;
        float sigma = d * uDensity;
        float column = gColumn;
        float od = lightOpticalDepth(p);
        // Denser pockets are darker — gives a closed deck its mottled base.
        vec3 ambient = mix(uAmbientBottom, uAmbientTop, smoothstep(0.0, 0.9, hf)) * mix(1.15, 0.7, d);
        vec3 L = uLightColor * max(sunEnergy(od, cosTheta), diffuseLight(od, hf, column)) + ambient;
        // Lightning lights the cloud from inside.
        L += vec3(0.8, 0.85, 1.0) * uFlash * 6.0 * exp(-distance(p, uFlashPos) / 1800.0);
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
    float fog = 1.0 - exp(-tFirst / uHazeDist);
    scat = mix(scat, uHazeColor * (1.0 - T), fog);
    float edge = smoothstep(uMaxDist * 0.45, uMaxDist, tFirst);
    scat *= 1.0 - edge;
    T = mix(T, 1.0, edge);
  }

  // Cirrus: thin streaks on a high shell, stretched along the wind, behind the volume.
  if (uHigh > 0.01 && T > 0.02) {
    float tc = raySphere(ro, rd, uEarthR + uCirrusAlt).y;
    if (tc > 0.0 && tc < 160000.0) {
      vec2 q = (ro + rd * tc).xz - uWindHigh;
      vec2 qw = vec2(dot(q, uHighWindDir), dot(q, vec2(-uHighWindDir.y, uHighWindDir.x)));
      float n = noise3(vec3(qw.x / 90000.0, qw.y / 14000.0, 0.57)).g;
      n = n * 0.7 + noise3(vec3(qw.x / 30000.0, qw.y / 5000.0, 0.11)).b * 0.3;
      float a = cirrusAlpha(noiseRank(n, CIRRUS_NOISE), uHigh) * (1.0 - smoothstep(60000.0, 160000.0, tc));
      vec3 col = uLightColor * mix(hg(cosTheta, 0.6), 1.0, 0.5) * 0.9 + uAmbientTop * 1.2;
      col = mix(col, uHazeColor, 1.0 - exp(-tc / (uHazeDist * 2.5)));
      scat += T * col * a;
      T *= 1.0 - a;
    }
  }

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

// God rays: a radial march from each pixel towards the on-screen sun over the
// resolved clouds' transmittance (Mitchell, GPU Gems 3 ch. 13). The source is
// open sky near the disc, so gaps by the sun cast streaks outwards and the
// clouds' shadows cut dark lanes between them. Half × half target, like the march.
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

float ign(vec2 p) {
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}

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
