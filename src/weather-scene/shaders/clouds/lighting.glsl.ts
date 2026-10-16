// Cloud lighting: phase function, the light march towards the sun/moon, the
// scattering octaves and the two-stream diffuse floor. Interpolated into
// CLOUD_MARCH_FRAG after CLOUD_DENSITY.

import { MAX_LIGHT_STEPS } from "../../core/quality";
import { TWO_STREAM_K } from "../../../weather/cloudPhysics";
import { glslFloat } from "../chunks.glsl";

export const CLOUD_LIGHTING = /* glsl */ `
// Aerial perspective: how far something t metres away has sunk into the
// horizon haze; k stretches the distance (thin high layers sink slower).
float aerial(float t, float k) {
  return 1.0 - exp(-t / (uHazeDist * k));
}

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); // ×4π-normalised
}

// Optical depth towards the light: growing steps through a near cone, then
// one long step for the bulk of a tall cell. Spreading the steps over a
// whole 4–5 km tower (first step ~350 m) quantised where the light ray left
// the cloud into terraces along the lit flank.
// The start is jittered (as the view march is): a fixed pattern laddered a
// low sun's lit flanks with bright stripes; the temporal resolve averages it.
const float LIGHT_CONE_M = 1000.0;
float lightOpticalDepth(vec3 p, float jitter) {
  float stepLen = min(uThickness * 0.45, LIGHT_CONE_M) / float(uLightSteps);
  float t = stepLen * (jitter - 0.5);
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
  // The rest of the old full-thickness reach (1.24 × thickness at 6 steps).
  float far = uThickness * 0.45 * (1.0 + 0.35 * float(uLightSteps - 1)) - t;
  if (far > 1.0) {
    vec3 q = p + uLightDir * (t + far * 0.5);
    float hf = heightFraction(q);
    if (hf >= 0.0 && hf <= 1.0) od += density(q, hf, false) * far;
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
const float TWO_STREAM_K = ${glslFloat(TWO_STREAM_K)};   // cloudPhysics.ts
const float DIFFUSE_GAIN = 1.1;
float diffuseLight(float od, float hf, float column) {
  // Thinner patches of a closed deck let more light through: seen from below
  // an overcast is mottled, not one flat grey.
  float tauAbove = min(od, uDeckTau * (1.0 - hf) * column);
  float mu = mix(0.35, 1.0, clamp(uLightDir.y / 0.7, 0.0, 1.0));
  return DIFFUSE_GAIN * mu * (1.0 - exp(-od * 1.5)) / (1.0 + TWO_STREAM_K * tauAbove);
}
`;
