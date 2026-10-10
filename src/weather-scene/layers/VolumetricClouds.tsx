import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  type Data3DTexture,
  HalfFloatType,
  LinearFilter,
  MathUtils,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGL3DRenderTarget,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { SceneParams } from "../../weather/sceneParams";
import type { VolumetricBudget } from "../core/quality";
import { useSceneSignals } from "../core/sceneSignals";
import {
  CAMERA_ALTITUDE_M,
  directionFromRelative,
  CLOUD_TIMELAPSE,
  EARTH_RADIUS_M,
  METRES_PER_UNIT,
  STORM_CLOUD_BASE_M,
} from "../core/worldFrame";
import { CLOUD_NOISE_FRAG, CLOUD_NOISE_VERT } from "../shaders/cloudNoise.glsl";
import {
  CLOUD_COMPOSITE_FRAG,
  CLOUD_COMPOSITE_VERT,
  VOLUMETRIC_FRAG,
  VOLUMETRIC_VERT,
} from "../shaders/volumetricClouds.glsl";

interface VolumetricCloudsProps {
  params: SceneParams;
  budget: VolumetricBudget;
}

const EYE_OFFSET = new Vector3(0, CAMERA_ALTITUDE_M, 0);

// ---------------------------------------------------------------------------
// 3D noise: generated once per size on the GPU, slice by slice, then cached
// for the page's lifetime (the quality tier can come back to it).
const noiseCache = new Map<number, WebGL3DRenderTarget>();

function getCloudNoise3D(gl: WebGLRenderer, size: number): Data3DTexture {
  const cached = noiseCache.get(size);
  if (cached) return cached.texture;
  const target = new WebGL3DRenderTarget(size, size, size, {
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  });
  target.texture.wrapS = RepeatWrapping;
  target.texture.wrapT = RepeatWrapping;
  target.texture.wrapR = RepeatWrapping;

  const material = new ShaderMaterial({
    uniforms: { uSlice: { value: 0 } },
    vertexShader: CLOUD_NOISE_VERT,
    fragmentShader: CLOUD_NOISE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new Scene().add(quad);
  const camera = new OrthographicCamera();
  const previous = gl.getRenderTarget();
  for (let z = 0; z < size; z++) {
    material.uniforms.uSlice.value = (z + 0.5) / size;
    gl.setRenderTarget(target, z);
    gl.render(scene, camera);
  }
  gl.setRenderTarget(previous);
  material.dispose();
  quad.geometry.dispose();
  noiseCache.set(size, target);
  return target.texture;
}

// ---------------------------------------------------------------------------
// Weather → shell parameters. Smoothed towards every frame, so preset
// switches morph instead of popping.
interface ShellTargets {
  coverage: number;
  type: number;
  thickness: number;
  base: number;
  density: number;
  high: number;
}

function shellTargets(params: SceneParams): ShellTargets {
  const { low, mid, high, total } = params.clouds;
  const { precip, thunder, fog } = params;
  const wet = precip.rainMmH > 0 || precip.snowCmH > 0;
  const type = thunder
    ? 1
    : precip.showers
      ? 0.75
      : low > 0.85
        ? wet
          ? 0.14
          : 0.06
        : 0.5;
  const thickness =
    type < 0.5
      ? MathUtils.lerp(650, 1800, type * 2)
      : MathUtils.lerp(1800, 8000, type * 2 - 1);
  const base =
    fog.visibilityM < 800
      ? 250
      : thunder
        ? STORM_CLOUD_BASE_M
        : MathUtils.lerp(700, 1300, Math.min(1, type * 2));
  return {
    coverage: MathUtils.clamp(Math.max(low, mid * 0.85, total * 0.6), 0, 1),
    type,
    thickness,
    base,
    density: 0.03 + (wet ? 0.02 : 0) + (thunder ? 0.02 : 0),
    high,
  };
}

const SUN_LOW = new Color("#ff5f2e");
const SUN_HIGH = new Color("#fff3e4");
const MOON_LIGHT = new Color("#a9bedf");
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

  const targets = useMemo(() => {
    const options = {
      type: HalfFloatType,
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
    };
    return [
      new WebGLRenderTarget(width, height, options),
      new WebGLRenderTarget(width, height, options),
    ];
  }, [width, height]);
  useEffect(() => () => targets.forEach((t) => t.dispose()), [targets]);

  const pass = useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: {
        uNoise: { value: null },
        uHistory: { value: null },
        uHistoryValid: { value: 0 },
        uFrame: { value: 0 },
        uInvProj: { value: new Matrix4() },
        uCamWorld: { value: new Matrix4() },
        uPrevViewProj: { value: new Matrix4() },
        uCamPos: { value: new Vector3() },
        uEarthR: { value: EARTH_RADIUS_M },
        uBase: { value: 1200 },
        uThickness: { value: 1500 },
        uCoverage: { value: 0 },
        uType: { value: 0.45 },
        uDensity: { value: 0.03 },
        uWind: { value: new Vector2() },
        uWindDir: { value: new Vector2(1, 0) },
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
      vertexShader: VOLUMETRIC_VERT,
      fragmentShader: VOLUMETRIC_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    return { material, quad, scene: new Scene().add(quad), camera: new OrthographicCamera() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      pass.material.dispose();
      pass.quad.geometry.dispose();
    },
    [pass],
  );

  const composite = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uClouds: { value: null } },
        vertexShader: CLOUD_COMPOSITE_VERT,
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
    read: 0,
    historyValid: false,
    shell: null as ShellTargets | null,
    prevViewProj: new Matrix4(),
  });

  // New render targets → no history to reuse.
  useEffect(() => {
    state.current.historyValid = false;
  }, [targets]);
  // Weather/debug changes snap the shell and restart accumulation — blending
  // towards a different cloud field would leave ghosts for a second.
  useEffect(() => {
    state.current.shell = null;
    state.current.historyValid = false;
  }, [targetsWanted]);

  const meshRef = useRef<Mesh>(null);

  useFrame((frameState, delta) => {
    const st = state.current;
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!noise) {
      mesh.visible = false;
      return;
    }
    const u = pass.material.uniforms;

    // Smooth the shell towards the weather.
    const want = targetsWanted;
    if (!st.shell) st.shell = { ...want };
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 1.5);
    const sh = st.shell;
    sh.coverage += (want.coverage - sh.coverage) * k;
    sh.type += (want.type - sh.type) * k;
    sh.thickness += (want.thickness - sh.thickness) * k;
    sh.base += (want.base - sh.base) * k;
    sh.density += (want.density - sh.density) * k;
    sh.high += (want.high - sh.high) * k;

    const empty = sh.coverage < 0.015 && sh.high < 0.01;
    mesh.visible = !empty;
    if (empty) {
      st.historyValid = false;
      return;
    }

    const camera = frameState.camera;
    u.uNoise.value = noise;
    (u.uInvProj.value as Matrix4).copy(camera.projectionMatrixInverse);
    (u.uCamWorld.value as Matrix4).copy(camera.matrixWorld);
    (u.uPrevViewProj.value as Matrix4).copy(st.prevViewProj);
    (u.uCamPos.value as Vector3)
      .copy(camera.position)
      .multiplyScalar(METRES_PER_UNIT)
      .add(EYE_OFFSET);

    u.uBase.value = sh.base;
    u.uThickness.value = sh.thickness;
    u.uCoverage.value = sh.coverage;
    u.uType.value = sh.type;
    u.uDensity.value = sh.density;
    u.uHigh.value = sh.high;
    u.uSteps.value = budget.steps;
    u.uLightSteps.value = budget.lightSteps;
    u.uMaxDist.value = budget.maxDistance;

    (u.uWind.value as Vector2).set(
      s.windOffset.x * CLOUD_TIMELAPSE,
      s.windOffset.z * CLOUD_TIMELAPSE,
    );
    const wl = Math.hypot(s.windVelocity.x, s.windVelocity.z) || 1;
    (u.uWindDir.value as Vector2).set(s.windVelocity.x / wl, s.windVelocity.z / wl);
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
        .copy(SUN_LOW)
        .lerp(SUN_HIGH, MathUtils.smoothstep(sunAltDeg, -3, 22))
        .multiplyScalar(1.3 * sunVis);
    } else {
      (u.uLightDir.value as Vector3).copy(s.moonDir);
      lightColor.copy(MOON_LIGHT).multiplyScalar(s.moonIntensity * 1.4);
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

    // Ping-pong: read history from one target, write the other.
    const read = targets[st.read];
    const write = targets[1 - st.read];
    u.uHistory.value = read.texture;
    u.uHistoryValid.value = st.historyValid ? 1 : 0;
    u.uFrame.value = st.frame;

    const gl = frameState.gl;
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(write);
    gl.render(pass.scene, pass.camera);
    gl.setRenderTarget(previous);

    composite.uniforms.uClouds.value = write.texture;
    st.read = 1 - st.read;
    st.frame++;
    st.historyValid = true;
    st.prevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  });

  return (
    <mesh ref={meshRef} material={composite} renderOrder={2} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
