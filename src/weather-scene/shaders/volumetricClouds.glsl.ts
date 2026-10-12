// Volumetric clouds — Nubis-style (Schneider, Horizon Zero Dawn) raymarch
// through a spherical shell above a curved Earth, in metres.
//
// Rendered into a low-res target; the camera barely moves (parallax only,
// history is reprojected by view direction), so each frame only one pixel of
// every 2×2 block is re-marched (with a fresh jitter) and blended with
// history — the rest is copied. A pixel converges over a few frames and
// the per-frame cost is ~1/4 of an already reduced resolution.
//
// Output is premultiplied: rgb = in-scattered radiance (pre-tonemap, "sky
// units"), a = 1 − transmittance. The composite pass tone-maps it over the sky.

export const VOLUMETRIC_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const VOLUMETRIC_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;


uniform sampler3D uNoise;
uniform sampler2D uHistory;
uniform float uHistoryValid;
uniform float uFrame;

uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform mat4 uPrevViewProj; // previous frame, for reprojecting history
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
    float dt = (tEnd - tStart) / float(uSteps);
    float t = tStart + dt * jitter;
    for (int i = 0; i < 128; i++) {
      if (i >= uSteps) break;
      vec3 p = ro + rd * t;
      float hf = heightFraction(p);
      float d = density(p, hf, true);
      if (d > 0.002) {
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
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 v = uInvProj * vec4(ndc, 1.0, 1.0);
  vec3 rd = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);

  // Clouds are effectively at infinity, so reprojecting by direction alone is
  // exact enough — this keeps history valid while the parallax rig rotates.
  vec4 prevClip = uPrevViewProj * vec4(rd, 0.0);
  vec2 prevUv = prevClip.xy / prevClip.w * 0.5 + 0.5;
  bool inside = prevClip.w > 0.0 && all(greaterThanEqual(prevUv, vec2(0.0))) && all(lessThanEqual(prevUv, vec2(1.0)));
  bool historyOk = uHistoryValid > 0.5 && inside;
  vec4 history = historyOk ? texture2D(uHistory, prevUv) : vec4(0.0);

  ivec2 px = ivec2(gl_FragCoord.xy);
  int phase = (px.x & 1) + 2 * (px.y & 1);
  int frame = int(mod(uFrame, 4.0));
  if (historyOk && phase != frame) {
    gl_FragColor = history;
    return;
  }

  float jitter = ign(gl_FragCoord.xy + vec2(5.588238 * uFrame, 2.71828 * uFrame));

  vec4 current = march(uCamPos, rd, jitter);
  gl_FragColor = historyOk ? mix(history, current, 0.2) : current;
}
`;

export const CLOUD_COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
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
