// Volumetric clouds — Nubis-style (Schneider, Horizon Zero Dawn) raymarch
// through a spherical shell above a curved Earth, in metres.
//
// Three passes per frame, all at a fraction of the canvas:
//   1. VOLUMETRIC_FRAG marches a half × half target: each texel is the one
//      pixel of its 2×2 block whose turn it is this frame (fresh jitter), so
//      the per-frame cost is ~1/4 of the cloud target.
//   2. CLOUD_RESOLVE_FRAG rebuilds the full cloud target: history is
//      reprojected by view direction (the camera only rotates a little) and
//      clipped to the variance of the freshly marched neighbourhood, so moving
//      or morphing clouds don't leave ghosts; the march is upsampled into it.
//   3. CLOUD_COMPOSITE_FRAG tone-maps the result over the sky.
//
// Cloud output is premultiplied: rgb = in-scattered radiance (pre-tonemap,
// "sky units"), a = 1 − transmittance.

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
uniform float uType;         // 0 stratus · 0.5 cumulus · 1 cumulonimbus
uniform float uDensity;      // extinction per metre at density 1
uniform vec2 uWind;          // accumulated drift of the low/mid layer (850 hPa), m (xz)
uniform vec2 uWindHigh;      // accumulated drift at cirrus level (300 hPa), m (xz)
uniform vec2 uHighWindDir;   // unit, xz — cirrus streaks stretch along it
uniform float uCirrusAlt;    // m above ground
uniform float uFreezeAlt;    // 0 °C level above ground, m — ice above it
uniform float uEvolve;       // slow morphing offset
uniform float uHigh;         // cirrus cover 0..1

uniform vec3 uLightDir;
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

float remap(float v, float l0, float h0, float l1, float h1) {
  return l1 + (v - l0) * (h1 - l1) / (h0 - l0);
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

// Local coverage from a slowly scrolling weather noise. Low global cover →
// isolated cells; cover 1 → closed deck.
float coverageAt(vec2 xz) {
  vec2 q = xz * WEATHER_SCALE;
  // Perlin-Worley + Worley at two scales — irregular cells, not round blobs.
  float n = texture(uNoise, vec3(q, 0.31 + uEvolve * 0.05)).r * 0.55
          + texture(uNoise, vec3(q * 0.43 + 0.29, 0.52)).g * 0.25
          + texture(uNoise, vec3(q * 2.3 + 0.17, 0.73)).g * 0.2;
  // Threshold slides with cover so roughly that fraction of the sky is cloud;
  // above ~0.8 the gaps close into a deck.
  float c = uCoverage;
  float th = mix(0.86, 0.22, c);
  return clamp(smoothstep(th, th + 0.2, n) + smoothstep(0.8, 1.0, c), 0.0, 1.0);
}

float density(vec3 p, float hf, bool detail) {
  if (hf < 0.0 || hf > 1.0) return 0.0;
  vec2 xz = p.xz - uWind;
  float cov = coverageAt(xz);
  if (cov < 0.01) return 0.0;

  // Cumulonimbus anvil: spread out near the top.
  cov = mix(cov, max(cov, smoothstep(0.75, 0.95, hf) * 0.85), step(0.9, uType));

  vec3 uvw = vec3(xz.x, p.y + uEvolve * 400.0, xz.y) * SHAPE_SCALE;
  vec4 n = texture(uNoise, uvw);
  float lowFbm = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
  float base = remap(n.r, lowFbm - 1.0, 1.0, 0.0, 1.0);
  base *= heightGradient(hf);
  base = remap(base, 1.0 - cov, 1.0, 0.0, 1.0) * cov;
  // A closed deck still has structure: undulating, lumpy base.
  base *= mix(1.0, 0.35 + 1.1 * lowFbm, smoothstep(0.75, 1.0, uCoverage));
  if (base <= 0.0) return 0.0;

  if (detail) {
    vec3 duvw = vec3(xz.x, p.y, xz.y) * DETAIL_SCALE + vec3(uEvolve * 2.0);
    vec4 d = texture(uNoise, duvw);
    float hfFbm = d.g * 0.625 + d.b * 0.25 + d.a * 0.125;
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
  for (int i = 0; i < 8; i++) {
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
    // Higher orders only matter where there is medium to scatter in —
    // they must not brighten thin edges (that drew white outlines).
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

// Adaptive march. The fine step grows with distance (a far sample covers
// more of the scene per pixel) but never drops below what crossing the shell
// in uSteps would need. Empty air is crossed with cheap steps 3× as long that
// skip the detail noise and the lighting; the first hit backs up one cheap
// step and switches to fine steps, and a few empty fine samples in a row
// switch back once past that hit. uSteps caps the lit (expensive) samples,
// not the iterations.
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
  float cosTheta = dot(rd, uLightDir);

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
        float od = lightOpticalDepth(p);
        // Denser pockets are darker — gives a closed deck its mottled base.
        vec3 ambient = mix(uAmbientBottom, uAmbientTop, smoothstep(0.0, 0.9, hf)) * mix(1.2, 0.5, d);
        vec3 L = uLightColor * sunEnergy(od, cosTheta) + ambient;
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
      float n = texture(uNoise, vec3(qw.x / 90000.0, qw.y / 14000.0, 0.57)).g;
      n = n * 0.7 + texture(uNoise, vec3(qw.x / 30000.0, qw.y / 5000.0, 0.11)).b * 0.3;
      float a = smoothstep(0.5, 0.82, n) * uHigh * 0.55 * (1.0 - smoothstep(60000.0, 160000.0, tc));
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

export const CLOUD_COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D uClouds;
varying vec2 vUv;
void main() {
  // The target holds premultiplied radiance. Un-premultiply BEFORE tone
  // mapping and sRGB encoding: encoding a premultiplied value inflates thin
  // edges (the linear toe of sRGB is ×12.92) and drew white outlines.
  vec4 c = texture2D(uClouds, vUv);
  float a = c.a;
  if (a < 0.002) discard;
  gl_FragColor = vec4(c.rgb / a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
