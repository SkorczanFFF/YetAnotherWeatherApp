import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  type Data3DTexture,
  HalfFloatType,
  LinearFilter,
  MathUtils,
  Matrix4,
  type Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { SceneParams } from "../../../weather/sceneParams";
import type { VolumetricBudget } from "../../core/quality";
import { useSceneSignals } from "../../core/sceneSignals";
import {
  CAMERA_ALTITUDE_M,
  directionFromRelative,
  CLOUD_TIMELAPSE,
  EARTH_RADIUS_M,
  METRES_PER_UNIT,
} from "../../core/worldFrame";
import { fullscreenVert } from "../../shaders/fullscreen.glsl";
import {
  CLOUD_COMPOSITE_FRAG,
  CLOUD_RESOLVE_FRAG,
  VOLUMETRIC_FRAG,
} from "../../shaders/volumetricClouds.glsl";
import { MAX_DT, RENDER_ORDER } from "../../core/constants";
import { CLOUD_MOON, CLOUD_SUN_HIGH, CLOUD_SUN_LOW } from "../../core/palette";
import { getCloudNoise3D } from "./cloudNoise3D";
import { fullscreenPass } from "./fullscreenPass";
import { SHELL_KEYS, shellTargets, type ShellTargets } from "./shellTargets";

/** Shell fields eased between weathers (1/s): ~95 % of the way in a second. */
const SHELL_EASE = 3;

interface VolumetricCloudsProps {
  params: SceneParams;
  budget: VolumetricBudget;
}

const EYE_OFFSET = new Vector3(0, CAMERA_ALTITUDE_M, 0);

const NIGHT_GLOW = new Color(0.03, 0.022, 0.017);

/**
 * Volumetric clouds (see shaders/volumetricClouds.glsl.ts): a low-res
 * raymarch into ping-pong render targets with temporal accumulation, then
 * one full-screen composite in the main scene (renderOrder 2 — over sky,
 * stars and moon, under precipitation).
 *
 * The raymarch is inherently "only where the camera looks": it runs per
 * pixel of the view, and the cost scales with the target size, not the sky.
 */
export function VolumetricClouds({ params, budget }: VolumetricCloudsProps) {
  const s = useSceneSignals();
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const width = Math.max(16, Math.round(size.width * dpr * budget.scale));
  const height = Math.max(16, Math.round(size.height * dpr * budget.scale));

  const [noise, setNoise] = useState<Data3DTexture | null>(null);
  useEffect(() => {
    setNoise(getCloudNoise3D(gl, budget.noiseSize));
  }, [gl, budget.noiseSize]);

  // The march covers one pixel per 2×2 block per frame; the resolve keeps
  // the full cloud target, ping-ponged so it can read last frame's.
  const targets = useMemo(() => {
    const options = {
      type: HalfFloatType,
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
    };
    return {
      march: new WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), options),
      history: [
        new WebGLRenderTarget(width, height, options),
        new WebGLRenderTarget(width, height, options),
      ],
    };
  }, [width, height]);
  useEffect(
    () => () => {
      targets.march.dispose();
      targets.history.forEach((t) => t.dispose());
    },
    [targets],
  );

  const march = useMemo(
    () =>
      fullscreenPass(
        new ShaderMaterial({
          uniforms: {
            uNoise: { value: null },
            uFrame: { value: 0 },
            uFullSize: { value: new Vector2() },
            uInvProj: { value: new Matrix4() },
            uCamWorld: { value: new Matrix4() },
            uCamPos: { value: new Vector3() },
            uEarthR: { value: EARTH_RADIUS_M },
            uBase: { value: 1200 },
            uThickness: { value: 1500 },
            uCoverage: { value: 0 },
            uType: { value: 0.45 },
            uDensity: { value: 0.03 },
            uFeatureScale: { value: 1 },
            uWind: { value: new Vector2() },
            uWindHigh: { value: new Vector2() },
            uHighWindDir: { value: new Vector2(1, 0) },
            uCirrusAlt: { value: 8500 },
            uFreezeAlt: { value: 3000 },
            uEvolve: { value: 0 },
            uHigh: { value: 0 },
            uLightDir: { value: new Vector3(0, 1, 0) },
            uLightColor: { value: new Color() },
            uAmbientTop: { value: new Color() },
            uAmbientBottom: { value: new Color() },
            uHazeColor: { value: new Color() },
            uHazeDist: { value: 30000 },
            uMaxDist: { value: budget.maxDistance },
            uSteps: { value: budget.steps },
            uLightSteps: { value: budget.lightSteps },
            uFlash: { value: 0 },
            uFlashPos: { value: new Vector3() },
          },
          vertexShader: fullscreenVert(),
          fragmentShader: VOLUMETRIC_FRAG,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    [],
  );
  useEffect(() => () => march.dispose(), [march]);

  const resolve = useMemo(
    () =>
      fullscreenPass(
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
      ),
    [],
  );
  useEffect(() => () => resolve.dispose(), [resolve]);

  const composite = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uClouds: { value: null } },
        vertexShader: fullscreenVert(1),
        fragmentShader: CLOUD_COMPOSITE_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => composite.dispose(), [composite]);

  const targetsWanted = useMemo(() => shellTargets(params), [params]);
  const state = useRef({
    frame: 0,
    /** Low/mid drift integrated in noise space (m ÷ featureScale). */
    windNoise: new Vector2(),
    read: 0,
    historyValid: false,
    prevViewProj: new Matrix4(),
    /** The shell actually drawn: eases towards targetsWanted. */
    shell: null as ShellTargets | null,
  });

  // New render targets → no history to reuse.
  useEffect(() => {
    state.current.historyValid = false;
  }, [targets]);

  const meshRef = useRef<Mesh>(null);

  useFrame((frameState, delta) => {
    const st = state.current;
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!noise) {
      mesh.visible = false;
      return;
    }
    const u = march.material.uniforms;

    // Weather/debug changes morph the shell over about a second instead of
    // snapping; the resolve's variance clipping keeps that free of ghosts.
    const sh = (st.shell ??= { ...targetsWanted });
    const dt = Math.min(delta, MAX_DT);
    for (const key of SHELL_KEYS) sh[key] = MathUtils.damp(sh[key], targetsWanted[key], SHELL_EASE, dt);
    const drift = (CLOUD_TIMELAPSE * dt) / sh.featureScale;
    st.windNoise.x += s.windVelocityLow.x * drift;
    st.windNoise.y += s.windVelocityLow.z * drift;

    // Below the shader's own cut-offs (cover fades in over 0..0.05, cirrus is skipped under 0.01).
    const empty = sh.coverage < 0.015 && sh.high < 0.01;
    mesh.visible = !empty;
    if (empty) {
      st.historyValid = false;
      return;
    }

    const camera = frameState.camera;
    const write = targets.history[1 - st.read];
    u.uNoise.value = noise;
    u.uFrame.value = st.frame;
    (u.uFullSize.value as Vector2).set(write.width, write.height);
    (u.uInvProj.value as Matrix4).copy(camera.projectionMatrixInverse);
    (u.uCamWorld.value as Matrix4).copy(camera.matrixWorld);
    (u.uCamPos.value as Vector3)
      .copy(camera.position)
      .multiplyScalar(METRES_PER_UNIT)
      .add(EYE_OFFSET);

    u.uBase.value = sh.base;
    u.uThickness.value = sh.thickness;
    u.uCoverage.value = sh.coverage;
    u.uType.value = sh.type;
    u.uDensity.value = sh.density;
    u.uFeatureScale.value = sh.featureScale;
    u.uHigh.value = sh.high;
    u.uCirrusAlt.value = sh.cirrusAlt;
    u.uFreezeAlt.value = sh.freezeAlt;
    u.uSteps.value = budget.steps;
    u.uLightSteps.value = budget.lightSteps;
    u.uMaxDist.value = budget.maxDistance;

    // Low/mid clouds ride the 850 hPa wind, cirrus the 300 hPa wind.
    (u.uWind.value as Vector2).copy(st.windNoise);
    (u.uWindHigh.value as Vector2).set(
      s.windOffsetHigh.x * CLOUD_TIMELAPSE,
      s.windOffsetHigh.z * CLOUD_TIMELAPSE,
    );
    const wh = Math.hypot(s.windVelocityHigh.x, s.windVelocityHigh.z) || 1;
    (u.uHighWindDir.value as Vector2).set(s.windVelocityHigh.x / wh, s.windVelocityHigh.z / wh);
    u.uEvolve.value = frameState.clock.elapsedTime * 0.002;

    // Key light: the sun keeps lighting cloud bases ~6° after it sets
    // (that's the red underside glow), then the moon takes over.
    const sunAltDeg = s.sunAlt * MathUtils.RAD2DEG;
    const sunVis = MathUtils.smoothstep(sunAltDeg, -6, 2);
    const lightColor = u.uLightColor.value as Color;
    if (sunVis > 0.02 || s.moonIntensity < 0.01) {
      // On-screen azimuth (so the glow sits around the visible sun) but the
      // REAL altitude: the squeezed display altitude would light every cloud
      // almost horizontally and outline it.
      const relAz = Math.atan2(s.sunDir.x, -s.sunDir.z);
      directionFromRelative(relAz, s.sunAlt, u.uLightDir.value as Vector3);
      lightColor
        .copy(CLOUD_SUN_LOW)
        .lerp(CLOUD_SUN_HIGH, MathUtils.smoothstep(sunAltDeg, -3, 22))
        .multiplyScalar(1.3 * sunVis);
    } else {
      (u.uLightDir.value as Vector3).copy(s.moonDir);
      lightColor.copy(CLOUD_MOON).multiplyScalar(s.moonIntensity * 1.4);
    }
    // Thick storm towers starve their own bases of light.
    const gloom = params.thunder ? 0.5 : params.precip.rainMmH > 4 ? 0.3 : 0;
    (u.uAmbientTop.value as Color).copy(s.hemiSky).multiplyScalar(1.35 * (1 - gloom));
    const ambientBottom = (u.uAmbientBottom.value as Color)
      .copy(s.hemiGround)
      .multiplyScalar(0.45)
      .lerp(s.hemiSky, 0.4)
      .multiplyScalar(1 - gloom);
    // Night: undersides pick up a faint warm glow from towns below.
    ambientBottom.r += NIGHT_GLOW.r * s.night;
    ambientBottom.g += NIGHT_GLOW.g * s.night;
    ambientBottom.b += NIGHT_GLOW.b * s.night;
    // Sky radiance is tone-mapped at exposure 0.5 — the haze target is in the same units.
    (u.uHazeColor.value as Color).copy(s.horizonColor).multiplyScalar(1.4);
    u.uHazeDist.value = MathUtils.clamp(params.fog.visibilityM * 1.2, 1200, 60000);

    u.uFlash.value = s.flash;
    (u.uFlashPos.value as Vector3)
      .copy(s.flashPosition)
      .multiplyScalar(METRES_PER_UNIT)
      .add(EYE_OFFSET);

    // Resolve: last frame's history (ping-pong) + this frame's march.
    const r = resolve.material.uniforms;
    r.uMarch.value = targets.march.texture;
    r.uHistory.value = targets.history[st.read].texture;
    r.uHistoryValid.value = st.historyValid ? 1 : 0;
    r.uFrame.value = st.frame;
    (r.uMarchSize.value as Vector2).set(targets.march.width, targets.march.height);
    (r.uInvProj.value as Matrix4).copy(camera.projectionMatrixInverse);
    (r.uCamWorld.value as Matrix4).copy(camera.matrixWorld);
    (r.uPrevViewProj.value as Matrix4).copy(st.prevViewProj);

    const gl = frameState.gl;
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(targets.march);
    gl.render(march.scene, march.camera);
    gl.setRenderTarget(write);
    gl.render(resolve.scene, resolve.camera);
    gl.setRenderTarget(previous);

    composite.uniforms.uClouds.value = write.texture;
    st.read = 1 - st.read;
    st.frame = (st.frame + 1) % 4096; // a multiple of 4; float precision stays exact
    st.historyValid = true;
    st.prevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  });

  return (
    <mesh ref={meshRef} material={composite} renderOrder={RENDER_ORDER.clouds} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
