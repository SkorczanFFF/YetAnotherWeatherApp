import { Color, MathUtils, Vector3 } from "three";
import type { SceneParams } from "../../../weather/sceneParams";
import { deckClosing, TWO_STREAM_K } from "../../../weather/cloudPhysics";
import type { SceneSignals } from "../../core/sceneSignals";
import { effectiveVisibilityM } from "../../core/worldFrame";
import { CLOUD_MOON, CLOUD_NIGHT_GLOW, CLOUD_SUN_HIGH, CLOUD_SUN_LOW } from "../../core/palette";
import { stormDim, type ShellTargets } from "./shellTargets";

// The clouds' light for this frame: key light (sun ↔ moon crossfade), its
// march and phase directions, ambient, adaptation and aerial-perspective haze.
// Pure: reads the signals and the eased shell, writes into `out`.

/** The march's lighting inputs; the march material's uniforms hold these same objects. */
export interface CloudLight {
  lightColor: Color;
  /** Light march: display azimuth, real altitude. */
  lightDir: Vector3;
  /** Phase (silver lining, forward glow): the full display direction. */
  phaseDir: Vector3;
  ambientTop: Color;
  ambientBottom: Color;
  hazeColor: Color;
  /** e-folding distance of aerial perspective, m. */
  hazeDist: number;
}

export function createCloudLight(): CloudLight {
  return {
    lightColor: new Color(),
    lightDir: new Vector3(0, 1, 0),
    phaseDir: new Vector3(0, 0, -1),
    ambientTop: new Color(),
    ambientBottom: new Color(),
    hazeColor: new Color(),
    hazeDist: 30000,
  };
}

/**
 * Under a closed deck the eye adapts: by day the cloud light is raised by
 * (1 + TWO_STREAM_K·τ)^ADAPT_POWER, at most ADAPT_MAX — thick decks stay darker
 * than thin ones, but grey, not black. The horizon haze isn't raised, so the
 * deck overhead ends up brighter than at the horizon, as a real overcast sky.
 */
const ADAPT_POWER = 0.35;
const ADAPT_MAX = 2.2;
/** Ambient lost under a storm (stormDim 1); heavy rain or snow (0.6) lose 0.3. */
const STORM_GLOOM = 0.5;
const moonColor = new Color();

export function cloudLighting(
  s: SceneSignals,
  shell: Pick<ShellTargets, "coverage" | "opticalDepth">,
  params: SceneParams,
  out: CloudLight,
): CloudLight {
  // Key light: the sun keeps lighting cloud bases ~6° after it sets
  // (that's the red underside glow), then the moon takes over.
  const sunVis = MathUtils.smoothstep(s.sunAltDeg, -6, 2);
  // Sun and moon crossfade (a hard switch jumped ~6× in brightness at dusk).
  // The light march uses the real altitude (signals.sunLightDir); the phase
  // (silver lining, forward glow) the full display direction, so it sits
  // around the visible disc, not off-frame above it.
  const sunEnergy = 1.3 * sunVis;
  const moonEnergy = 1.4 * s.moonIntensity * (1 - sunVis);
  const lightColor = out.lightColor
    .copy(CLOUD_SUN_LOW)
    .lerp(CLOUD_SUN_HIGH, MathUtils.smoothstep(s.sunAltDeg, -3, 22))
    .multiplyScalar(sunEnergy);
  lightColor.add(moonColor.copy(CLOUD_MOON).multiplyScalar(moonEnergy));
  const lightDir = out.lightDir
    .copy(s.sunLightDir)
    .multiplyScalar(sunEnergy)
    .addScaledVector(s.moonLightDir, moonEnergy);
  if (lightDir.lengthSq() < 1e-8) lightDir.copy(s.sunLightDir);
  lightDir.normalize();
  const phaseDir = out.phaseDir
    .copy(s.sunDir)
    .multiplyScalar(sunEnergy)
    .addScaledVector(s.moonDir, moonEnergy);
  if (phaseDir.lengthSq() < 1e-8) phaseDir.copy(s.sunDir);
  phaseDir.normalize();
  // Daylight adaptation under a closed deck (see ADAPT_POWER).
  const closed = deckClosing(shell.coverage);
  const adapt =
    1 + closed * s.day * (Math.min(ADAPT_MAX, Math.pow(1 + TWO_STREAM_K * shell.opticalDepth, ADAPT_POWER)) - 1);
  lightColor.multiplyScalar(adapt);
  // Thick storm and rain clouds starve their own bases of light.
  const gloom = STORM_GLOOM * stormDim(params);
  out.ambientTop.copy(s.hemiSky).multiplyScalar(1.35 * (1 - gloom) * adapt);
  const ambientBottom = out.ambientBottom
    .copy(s.hemiGround)
    .multiplyScalar(0.45)
    .lerp(s.hemiSky, 0.4)
    .multiplyScalar((1 - gloom) * adapt);
  // Night: undersides pick up a faint warm glow from towns below.
  ambientBottom.r += CLOUD_NIGHT_GLOW.r * s.night;
  ambientBottom.g += CLOUD_NIGHT_GLOW.g * s.night;
  ambientBottom.b += CLOUD_NIGHT_GLOW.b * s.night;
  // Sky radiance is tone-mapped at exposure 0.5 — the haze target is in the same units.
  out.hazeColor.copy(s.horizonColor).multiplyScalar(1.4);
  // The same visibility as the sky's haze (heat shimmer included).
  out.hazeDist = MathUtils.clamp(effectiveVisibilityM(params.fog.visibilityM, params.temperatureC) * 1.2, 1200, 60000);
  return out;
}
