import { Color, MathUtils } from "three";
import type { SceneParams } from "../../weather/sceneParams";
import { skyClosure } from "../../weather/cloudPhysics";
import type { SceneSignals } from "./sceneSignals";
import { effectiveVisibilityM, heatShimmer } from "./worldFrame";
import {
  DAY_HAZE,
  GROUND_DAY,
  GROUND_NIGHT,
  HAZE_OVERCAST_DAY,
  HAZE_OVERCAST_DUSK,
  HAZE_OVERCAST_NIGHT,
  HEAT_HAZE,
  HEMI_DAY,
  HEMI_NIGHT,
  HEMI_OVERCAST,
  NIGHT_HAZE,
  RIME_FOG,
  SUN_HIGH,
  SUN_LOW,
  TWILIGHT,
} from "./palette";

// Light and colour of the sky from the REAL sun altitude and the weather:
// day/night factors, how far the deck greys the sky, haze, the horizon colour
// and the light colours the clouds use. Pure: writes only into the signals.

const smoothstep = MathUtils.smoothstep;
const scratch = new Color();

/**
 * Writes day, night, warmth, lowSun, sunDisc, moonDisc, overcast, cloudFill, haze, horizonColor,
 * sunColor, moonIntensity, hemiSky and hemiGround. Needs this frame's
 * sunAlt, moonAlt and moonFraction.
 */
export function updateSkyLight(s: SceneSignals, params: SceneParams): void {
  const a = s.sunAltDeg;
  daylight(s, a);
  deckShading(s, params.clouds);
  hazeAndHorizon(s, params, a);
  lightColours(s, a);
}

/** Day / night factors from the real sun altitude (degrees). */
function daylight(s: SceneSignals, a: number): void {
  s.day = smoothstep(a, -2, 8);
  s.night = 1 - smoothstep(a, -12, -3);
  s.warmth = (1 - smoothstep(a, 2, 18)) * smoothstep(a, -8, 0);
  s.lowSun = 1 - smoothstep(a, 0, 10);
  s.sunDisc = smoothstep(a, -1, 0.5);
  // The moon's display position sits low in the horizon haze for longer.
  s.moonDisc = smoothstep(s.moonAltDeg, -1, 2);
}

/** The low cover closing from `lowFrom`, or (× 0.8) the low/mid sky closing from `skyFrom`. */
function deckRamp(clouds: SceneParams["clouds"], lowFrom: number, skyFrom: number): number {
  return Math.max(smoothstep(clouds.low, lowFrom, 1.0), smoothstep(skyClosure(clouds), skyFrom, 1.0) * 0.8);
}

function deckShading(s: SceneSignals, clouds: SceneParams["clouds"]): void {
  // Only a closing low/mid deck greys the sky — the gaps of a broken one
  // show clear blue; cirrus (in the total) only veils it.
  s.overcast = deckRamp(clouds, 0.8, 0.85);
  // The frame never shows the zenith, so a broken deck already fills most
  // of it with bright cloud (what the UI glass sits over).
  s.cloudFill = deckRamp(clouds, 0.55, 0.7);
}

function hazeAndHorizon(s: SceneSignals, params: SceneParams, a: number): void {
  const { fog, temperatureC } = params;
  // Koschmieder — 95 % extinction at the visibility distance.
  const heat = heatShimmer(temperatureC);
  const visibility = effectiveVisibilityM(fog.visibilityM, temperatureC);
  s.haze = MathUtils.clamp(1 - (Math.log10(visibility) - 2.5) / 1.9, 0, 1);

  // Warm from a low sun down through twilight, dimming until night takes over —
  // not keyed to `warmth`, which is back to 0 by −8° while the horizon still glows.
  const horizon = s.horizonColor
    .copy(DAY_HAZE)
    .lerp(TWILIGHT, 1 - smoothstep(a, 2, 18))
    .multiplyScalar(1 - 0.55 * (1 - smoothstep(a, -8, 0)));
  horizon.lerp(NIGHT_HAZE, s.night);
  if (heat > 0) horizon.lerp(HEAT_HAZE, heat * 0.5 * s.day);
  // Under an overcast at dusk the deck's base glows red (lit from ~6° under the
  // horizon), so the haze below it goes dark and warm (keyed to lowSun, not warmth).
  const overcastTint = scratch
    .copy(HAZE_OVERCAST_DAY)
    .lerp(HAZE_OVERCAST_DUSK, s.lowSun)
    .lerp(HAZE_OVERCAST_NIGHT, s.night);
  horizon.lerp(overcastTint, s.overcast * 0.85);
  if (fog.rime) horizon.lerp(RIME_FOG, 0.6 * (1 - s.night * 0.85));
  // Under a storm the light at the horizon is dim too.
  if (params.thunder) horizon.multiplyScalar(0.72);
}

/** Light colours for the clouds. */
function lightColours(s: SceneSignals, a: number): void {
  s.sunColor.copy(SUN_LOW).lerp(SUN_HIGH, smoothstep(a, 0, 20));
  s.sunColorDisplay.copy(s.sunColor).convertLinearToSRGB();
  s.moonIntensity =
    s.night *
    smoothstep(s.moonAltDeg, -1, 5) *
    (0.25 + 0.75 * s.moonFraction) *
    0.45 *
    (1 - 0.7 * s.overcast);
  s.hemiSky.copy(HEMI_NIGHT).lerp(HEMI_DAY, s.day);
  s.hemiSky.lerp(scratch.copy(HEMI_OVERCAST).multiplyScalar(0.25 + 0.75 * s.day), s.overcast * 0.7);
  s.hemiGround.copy(GROUND_NIGHT).lerp(GROUND_DAY, s.day);
}
