import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Data3DTexture, MathUtils, Matrix4, type Mesh, Vector2, Vector3, type Vector4 } from "three";
import type { SceneParams } from "../../../weather/sceneParams";
import type { VolumetricBudget } from "../../core/quality";
import { NO_CLOUD_COVER, useSceneSignals } from "../../core/sceneSignals";
import { CAMERA_ALTITUDE_M, CLOUD_TIMELAPSE, METRES_PER_UNIT } from "../../core/worldFrame";
import { MAX_DT, RENDER_ORDER } from "../../core/constants";
import { getCloudNoise3D } from "./cloudNoise3D";
import { highDrift, lowDrift } from "./cloudDrift";
import { cloudLighting, createCloudLight } from "./cloudLighting";
import {
  createCloudTargets,
  createCompositeMaterial,
  createMarchPass,
  createRaysPass,
  createResolvePass,
  disposeCloudTargets,
  setShellUniforms,
} from "./cloudPasses";
import { drawRays } from "./godRays";
import { SHELL_KEYS, shellTargets, type ShellTargets } from "./shellTargets";
import { COVER_FADE_IN } from "../../shaders/clouds/density.glsl";
import { LAYER_MIN } from "../../shaders/clouds/layers.glsl";

/** Shell fields eased between weathers (1/s): ~95 % of the way in a second. */
const SHELL_EASE = 3;
/** Shell cover under which the march is skipped: well inside its fade-in (COVER_FADE_IN), a cell draws next to nothing. */
const COVER_SKIP = 0.3 * COVER_FADE_IN;

interface VolumetricCloudsProps {
  params: SceneParams;
  budget: VolumetricBudget;
}

const EYE_OFFSET = new Vector3(0, CAMERA_ALTITUDE_M, 0);

/**
 * Low-res raymarch + temporal resolve into ping-pong targets, then one full-screen
 * composite in the main scene (see CLAUDE.md › Scene rendering pipeline).
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

  const targets = useMemo(() => createCloudTargets(width, height), [width, height]);
  useEffect(() => () => disposeCloudTargets(targets), [targets]);

  const light = useMemo(createCloudLight, []);
  const march = useMemo(() => createMarchPass(light), [light]);
  useEffect(() => () => march.dispose(), [march]);
  const resolve = useMemo(createResolvePass, []);
  useEffect(() => () => resolve.dispose(), [resolve]);
  const rays = useMemo(createRaysPass, []);
  useEffect(() => () => rays.dispose(), [rays]);
  const composite = useMemo(createCompositeMaterial, []);
  useEffect(() => () => composite.dispose(), [composite]);
  const rayPasses = useMemo(() => ({ rays, composite, targets }), [rays, composite, targets]);

  // The potato deck has no cloud target: readers see no occlusion.
  useEffect(
    () => () => {
      s.cloudCover = NO_CLOUD_COVER;
    },
    [s],
  );

  const targetsWanted = useMemo(() => shellTargets(params), [params]);
  const state = useRef({
    frame: 0,
    /** Low/mid drift integrated in noise space (m ÷ featureScale). */
    windNoise: new Vector2(),
    read: 0,
    historyValid: false,
    /** Targets the history belongs to; new targets have none to reuse. */
    historyOf: null as object | null,
    prevViewProj: new Matrix4(),
    /** The shell actually drawn: eases towards targetsWanted. */
    shell: null as ShellTargets | null,
  });

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

    const camera = frameState.camera;
    const gl = frameState.gl;

    // A clear sky skips the march but keeps the glare round the sun.
    if (sh.coverage < COVER_SKIP && sh.high < LAYER_MIN && sh.midLayer < LAYER_MIN) {
      st.historyValid = false;
      composite.uniforms.uClouds.value = NO_CLOUD_COVER;
      s.cloudCover = NO_CLOUD_COVER;
      mesh.visible = drawRays(gl, camera, s, NO_CLOUD_COVER, sh.coverage, budget.raySamples, rayPasses);
      return;
    }
    mesh.visible = true;

    if (st.historyOf !== targets) {
      st.historyOf = targets;
      st.historyValid = false;
    }
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

    setShellUniforms(march, sh);
    u.uSteps.value = budget.steps;
    u.uLightSteps.value = budget.lightSteps;
    u.uMaxDist.value = budget.maxDistance;

    // Low/mid clouds ride the 850 hPa wind, cirrus the 300 hPa wind.
    lowDrift(st.windNoise, u.uWind.value as Vector2, u.uWindDetail.value as Vector2);
    const wh = Math.hypot(s.windVelocityHigh.x, s.windVelocityHigh.z) || 1;
    const highDir = (u.uHighWindDir.value as Vector2).set(s.windVelocityHigh.x / wh, s.windVelocityHigh.z / wh);
    highDrift(
      s.windOffsetHigh.x * CLOUD_TIMELAPSE,
      s.windOffsetHigh.z * CLOUD_TIMELAPSE,
      highDir,
      u.uMidDrift.value as Vector2,
      u.uCirrusDrift.value as Vector4,
    );
    u.uEvolve.value = frameState.clock.elapsedTime * 0.002;

    // Writes the lighting uniforms in place (they are `light`'s objects).
    cloudLighting(s, sh, params, light);
    u.uHazeDist.value = light.hazeDist;

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

    const previous = gl.getRenderTarget();
    gl.setRenderTarget(targets.march);
    gl.render(march.scene, march.camera);
    gl.setRenderTarget(write);
    gl.render(resolve.scene, resolve.camera);

    gl.setRenderTarget(previous);
    drawRays(gl, camera, s, write.texture, sh.coverage, budget.raySamples, rayPasses);

    composite.uniforms.uClouds.value = write.texture;
    s.cloudCover = write.texture;
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
