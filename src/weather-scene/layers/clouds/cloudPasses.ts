import {
  Color,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import { fullscreenVert } from "../../shaders/fullscreen.glsl";
import { CLOUD_MARCH_FRAG } from "../../shaders/clouds/march.glsl";
import { CLOUD_RESOLVE_FRAG } from "../../shaders/clouds/resolve.glsl";
import { CLOUD_RAYS_FRAG } from "../../shaders/clouds/rays.glsl";
import { CLOUD_COMPOSITE_FRAG } from "../../shaders/clouds/composite.glsl";
import type { CloudLight } from "./cloudLighting";
import { fullscreenPass, type FullscreenPass } from "./fullscreenPass";
import type { ShellTargets } from "./shellTargets";

// Materials and render targets of the cloud passes (shaders/clouds/march.glsl
// describes what each pass does). Initial uniform values are placeholders:
// <VolumetricClouds> writes every one before it renders.

/**
 * The march covers one pixel per 2×2 block per frame; the resolve keeps the
 * full cloud target, ping-ponged so it can read last frame's.
 */
export function createCloudTargets(width: number, height: number) {
  const options = {
    type: HalfFloatType,
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  };
  return {
    march: new WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), options),
    rays: new WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), options),
    history: [
      new WebGLRenderTarget(width, height, options),
      new WebGLRenderTarget(width, height, options),
    ],
  };
}

export type CloudTargets = ReturnType<typeof createCloudTargets>;

export function disposeCloudTargets(targets: CloudTargets): void {
  targets.march.dispose();
  targets.rays.dispose();
  targets.history.forEach((t) => t.dispose());
}

/** The march's lighting uniforms are `light`'s own objects: cloudLighting() writes them in place. */
export function createMarchPass(light: CloudLight): FullscreenPass {
  return fullscreenPass(
    new ShaderMaterial({
      uniforms: {
        uNoise: { value: null },
        uFrame: { value: 0 },
        uFullSize: { value: new Vector2() },
        uInvProj: { value: new Matrix4() },
        uCamWorld: { value: new Matrix4() },
        uCamPos: { value: new Vector3() },
        uBase: { value: 1200 },
        uThickness: { value: 1500 },
        uCoverage: { value: 0 },
        uType: { value: 0.45 },
        uDensity: { value: 0.03 },
        uDeckTau: { value: 10 },
        uFeatureScale: { value: 1 },
        uWind: { value: new Vector2() },
        uWindDetail: { value: new Vector2() },
        uMidDrift: { value: new Vector2() },
        uCirrusDrift: { value: new Vector4() },
        uHighWindDir: { value: new Vector2(1, 0) },
        uCirrusAlt: { value: 8500 },
        uMid: { value: 0 },
        uMidAlt: { value: 4000 },
        uFreezeAlt: { value: 3000 },
        uEvolve: { value: 0 },
        uHigh: { value: 0 },
        uLightDir: { value: light.lightDir },
        uPhaseDir: { value: light.phaseDir },
        uLightColor: { value: light.lightColor },
        uAmbientTop: { value: light.ambientTop },
        uAmbientBottom: { value: light.ambientBottom },
        uHazeColor: { value: light.hazeColor },
        uHazeDist: { value: light.hazeDist },
        uMaxDist: { value: 0 },
        uSteps: { value: 0 },
        uLightSteps: { value: 0 },
        uFlash: { value: 0 },
        uFlashPos: { value: new Vector3() },
      },
      vertexShader: fullscreenVert(),
      fragmentShader: CLOUD_MARCH_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

/** The eased shell → the march's uniforms. */
export function setShellUniforms(march: FullscreenPass, sh: ShellTargets): void {
  const u = march.material.uniforms;
  u.uBase.value = sh.base;
  u.uThickness.value = sh.thickness;
  u.uCoverage.value = sh.coverage;
  u.uType.value = sh.type;
  u.uDensity.value = sh.density;
  u.uDeckTau.value = sh.opticalDepth;
  u.uFeatureScale.value = sh.featureScale;
  u.uHigh.value = sh.high;
  u.uMid.value = sh.midLayer;
  u.uMidAlt.value = sh.midAlt;
  u.uCirrusAlt.value = sh.cirrusAlt;
  u.uFreezeAlt.value = sh.freezeAlt;
}

export function createResolvePass(): FullscreenPass {
  return fullscreenPass(
    new ShaderMaterial({
      uniforms: {
        uMarch: { value: null },
        uHistory: { value: null },
        uHistoryValid: { value: 0 },
        uFrame: { value: 0 },
        uMarchSize: { value: new Vector2() },
        uInvProj: { value: new Matrix4() },
        uCamWorld: { value: new Matrix4() },
        uPrevViewProj: { value: new Matrix4() },
      },
      vertexShader: fullscreenVert(),
      fragmentShader: CLOUD_RESOLVE_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

export function createRaysPass(): FullscreenPass {
  return fullscreenPass(
    new ShaderMaterial({
      uniforms: {
        uClouds: { value: null },
        uSunUv: { value: new Vector2() },
        uAspect: { value: 1 },
        uHorizonV: { value: 0 },
        uSamples: { value: 0 },
      },
      vertexShader: fullscreenVert(),
      fragmentShader: CLOUD_RAYS_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

/** The full-screen composite in the main scene (its mesh lives in <VolumetricClouds>). */
export function createCompositeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uClouds: { value: null },
      uRays: { value: null },
      uRayColor: { value: new Color(0, 0, 0) },
      uRayShadow: { value: 0 },
      uRayTexel: { value: new Vector2() },
    },
    vertexShader: fullscreenVert(1),
    fragmentShader: CLOUD_COMPOSITE_FRAG,
    transparent: true,
    // The shader writes premultiplied colour: cloud × alpha + additive rays.
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
}
