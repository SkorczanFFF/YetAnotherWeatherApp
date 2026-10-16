// Sky grade: a camera-centred inverted sphere drawn right after drei <Sky>.
// Composites, back to front: night gradient → overcast grey → horizon haze /
// fog → below-horizon ground haze → lightning flash. One draw call does all
// the "what Preetham can't" work. z = w pins it to the far plane.

import { SKY_FLASH, SKY_GROUND } from "../core/palette";
import { glslColor } from "./chunks.glsl";

export const SKY_GRADE_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

export const SKY_GRADE_FRAG = /* glsl */ `
uniform vec3 uNightZenith;
uniform vec3 uNightHorizon;
uniform vec3 uOvercastColor;
uniform vec3 uHazeColor;
uniform float uNight;
uniform float uOvercast;
uniform float uHaze;
uniform float uFlash;

varying vec3 vDir;

// Straight-alpha "over".
vec4 over(vec4 top, vec4 under) {
  float a = top.a + under.a * (1.0 - top.a);
  vec3 c = (top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / max(a, 1e-4);
  return vec4(c, a);
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;

  vec4 acc = vec4(mix(uNightHorizon, uNightZenith, smoothstep(-0.02, 0.55, h)), uNight);

  vec3 oc = uOvercastColor * (0.92 + 0.14 * (1.0 - smoothstep(0.0, 0.5, h)));
  acc = over(vec4(oc, uOvercast), acc);

  // Haze hugs the horizon (a little is always there — it softens Preetham's
  // dark extinction band); dense fog (uHaze → 1) swallows the whole sky.
  float band = 1.0 - smoothstep(-0.02, 0.18 + 0.5 * uHaze, h);
  float hazeA = max(uHaze, 0.22) * band + smoothstep(0.65, 1.0, uHaze) * (1.0 - band);
  acc = over(vec4(uHazeColor, clamp(hazeA, 0.0, 1.0)), acc);

  // There is no ground mesh: below the horizon fades into a darker haze.
  float ground = smoothstep(0.012, -0.05, h);
  acc = over(vec4(mix(uHazeColor * 0.45, ${glslColor(SKY_GROUND)}, 0.45), ground * 0.94), acc);

  acc = over(vec4(${glslColor(SKY_FLASH)}, clamp(uFlash * 0.5, 0.0, 1.0)), acc);

  gl_FragColor = acc;
  #include <colorspace_fragment>
}
`;
