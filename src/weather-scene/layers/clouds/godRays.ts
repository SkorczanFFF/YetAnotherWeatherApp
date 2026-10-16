import {
  type Camera,
  type Color,
  MathUtils,
  type ShaderMaterial,
  type Texture,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from "three";
import { projectToScreen, type ScreenPoint } from "../../core/celestial";
import type { SceneSignals } from "../../core/sceneSignals";
import type { CloudTargets } from "./cloudPasses";
import type { FullscreenPass } from "./fullscreenPass";

/** God-ray brightness at full strength, display space (tuned by eye). */
const RAY_GAIN = 2.6;
/** How deep the clouds' shadow lanes cut into the bright air round the sun (tuned by eye). */
const RAY_SHADOW_GAIN = 1.6;
/** Share of RAY_GAIN left as glare around the disc in a sky without shafts. */
const RAY_CLEAR_FLOOR = 0.25;
/** Straight ahead at elevation 0. */
const HORIZON_DIR = new Vector3(0, 0, -1);

const sun: ScreenPoint = { u: 0, v: 0, w: 0, offFrame: 0 };
const horizon: ScreenPoint = { u: 0, v: 0, w: 0, offFrame: 0 };

/** 0 = no rays: the sun up and near the frame, cloud to cut shafts, haze to show them, no fog. */
export function rayStrength(s: SceneSignals, sunOnScreen: ScreenPoint, coverage: number): number {
  return sunOnScreen.w > 0
    ? MathUtils.smoothstep(s.sunAltDeg, -1, 6) *
        (1 - MathUtils.smoothstep(sunOnScreen.offFrame, 0, 0.4)) *
        MathUtils.lerp(RAY_CLEAR_FLOOR, 1, MathUtils.smoothstep(coverage, 0.08, 0.35)) *
        // Haze makes the shafts visible; fog swallows them.
        (0.75 + 0.5 * s.haze) *
        (1 - MathUtils.smoothstep(s.haze, 0.7, 1))
    : 0;
}

export interface RayPasses {
  rays: FullscreenPass;
  composite: ShaderMaterial;
  targets: CloudTargets;
}

/**
 * God rays into the rays target and the composite's ray uniforms. Without
 * clouds to cut them into shafts the same pass is a soft glare around the disc
 * (a floor of RAY_CLEAR_FLOOR) — the bare Preetham disc read as a flat white
 * dot. Returns whether the composite has rays to draw. Runs inside useFrame.
 */
export function drawRays(
  gl: WebGLRenderer,
  camera: Camera,
  s: SceneSignals,
  clouds: Texture,
  coverage: number,
  samples: number,
  { rays, composite, targets }: RayPasses,
): boolean {
  projectToScreen(s.sunDir, camera, sun);
  const strength = rayStrength(s, sun, coverage);
  const rayColor = composite.uniforms.uRayColor.value as Color;
  composite.uniforms.uRays.value = targets.rays.texture;
  (composite.uniforms.uRayTexel.value as Vector2).set(1 / targets.rays.width, 1 / targets.rays.height);
  if (strength <= 0.002) {
    rayColor.setRGB(0, 0, 0);
    composite.uniforms.uRayShadow.value = 0;
    return false;
  }
  const ru = rays.material.uniforms;
  ru.uClouds.value = clouds;
  (ru.uSunUv.value as Vector2).set(sun.u, sun.v);
  ru.uAspect.value = targets.rays.width / targets.rays.height;
  ru.uHorizonV.value = projectToScreen(HORIZON_DIR, camera, horizon).v;
  ru.uSamples.value = samples;
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(targets.rays);
  gl.render(rays.scene, rays.camera);
  gl.setRenderTarget(previous);
  rayColor.copy(s.sunColorDisplay).multiplyScalar(strength * RAY_GAIN);
  composite.uniforms.uRayShadow.value = strength * RAY_SHADOW_GAIN;
  return true;
}
