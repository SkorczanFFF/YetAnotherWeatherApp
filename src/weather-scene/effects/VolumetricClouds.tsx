import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  Atmosphere,
  AtmosphereContext,
  AerialPerspective,
} from "@takram/three-atmosphere/r3f";
import { DEFAULT_PRECOMPUTED_TEXTURES_URL } from "@takram/three-atmosphere";
import { Clouds } from "@takram/three-clouds/r3f";
import { Ellipsoid } from "@takram/three-geospatial";
import {
  EffectComposer,
  GodRays,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { SimulationConfig } from "../types";
import { useSceneRefsRequired } from "../SceneRefsContext";
import { buildCloudsProps } from "./volumetricClouds/cloudProps";
import {
  detectQualityTier,
  getRuntimePreset,
} from "./volumetricClouds/qualityPreset";
import {
  buildSunFlareProps,
  buildMoonFlareProps,
  getTimeGates,
} from "./lensFlare/flareProps";
import { BodyLensFlare } from "./lensFlare/BodyLensFlare";

const SUN_DISTANCE = 1000;
const MOON_DISTANCE = 1000;
const SUN_GLOW_RADIUS = 9;
const MOON_RADIUS = 4;

// Place world origin ~500m above the WGS84 ellipsoid surface at (lat=0, lon=0).
// Camera at world y=0 ≈ 500m altitude — a comfortable "observer on the ground"
// altitude that sits below all of @takram/three-clouds's default cloud layers
// (lowest starts at 750m), so clouds render above the horizon. worldToECEFMatrix
// is a North-Up-East frame: world +X=north, world +Y=up, world +Z=east.
const ORIGIN_ALTITUDE = 500;
const SURFACE_ECEF = new THREE.Vector3(6378137 + ORIGIN_ALTITUDE, 0, 0);

// Diagnostic toggles. Isolate what is actually painting the brown overlay
// after the first second of rendering by flipping each false→true until the
// overlay appears.
const CLOUDS_ENABLED = false;
const LENS_FLARE_ENABLED = false;
const GOD_RAYS_ENABLED = false;
const SUN_SPRITE_ENABLED = false;

interface VolumetricCloudsProps {
  config: SimulationConfig;
}

function SunSprite({ onReady }: { onReady: (mesh: THREE.Mesh) => void }) {
  const sceneRefs = useSceneRefsRequired();
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const setRef = useRef((el: THREE.Mesh | null) => {
    sceneRefs.sunMeshRef.current = el;
    if (el) onReadyRef.current(el);
  }).current;
  // Start hidden; useFrame flips `visible` once the ECEF→world transform has
  // been applied and sun position is real (not the default 0,0,0 at the
  // camera, which would put the camera inside the glow sphere).
  return (
    <mesh ref={setRef} frustumCulled={false} visible={false}>
      <sphereGeometry args={[SUN_GLOW_RADIUS, 32, 32]} />
      <meshBasicMaterial
        color={0xffb347}
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function SceneInsideAtmosphere({ config }: VolumetricCloudsProps) {
  const sceneRefs = useSceneRefsRequired();
  const atmosphere = useContext(AtmosphereContext);

  const preset = useMemo(() => getRuntimePreset(detectQualityTier()), []);

  const cloudsProps = useMemo(() => buildCloudsProps(config), [config]);
  const sunFlareProps = useMemo(() => buildSunFlareProps(config), [config]);
  const moonFlareProps = useMemo(() => buildMoonFlareProps(), []);
  const gates = useMemo(
    () => getTimeGates(config.timeOfDay, config.thunderstorm),
    [config.timeOfDay, config.thunderstorm],
  );

  const coverageLerpRef = useRef(config.cloudCover ?? 0);
  const [sunMesh, setSunMesh] = useState<THREE.Mesh | null>(null);
  const ecefToWorldRef = useRef(new THREE.Matrix4());
  const worldDirScratch = useRef(new THREE.Vector3());
  const sunPositionedRef = useRef(false);

  // Install the world→ECEF frame synchronously before r3f starts its render
  // loop. useEffect can race with AerialPerspective's useFrame on the first
  // paint (AP copies an identity matrix into its uniform), which leaves the
  // shader looking at Earth's interior until the second frame at best.
  // useLayoutEffect runs in the commit phase, before the r3f loop kicks off.
  useLayoutEffect(() => {
    const w = atmosphere?.transientStates?.worldToECEFMatrix;
    if (!w) return;
    Ellipsoid.WGS84.getNorthUpEastFrame(SURFACE_ECEF, w);
    ecefToWorldRef.current.copy(w).invert();
  }, [atmosphere]);

  const sunOpacityRef = useRef(0);
  const moonOpacityRef = useRef(0);
  const sunColorRef = useRef(sunFlareProps.colorGain.clone());
  const moonColorRef = useRef(moonFlareProps.colorGain.clone());

  useEffect(() => {
    sunColorRef.current.copy(sunFlareProps.colorGain);
  }, [sunFlareProps]);
  useEffect(() => {
    moonColorRef.current.copy(moonFlareProps.colorGain);
  }, [moonFlareProps]);

  const sunFlareConfig = useMemo(
    () => ({
      glareSize: sunFlareProps.glareSize,
      flareSize: sunFlareProps.flareSize,
      starPoints: sunFlareProps.starPoints,
      flareSpeed: sunFlareProps.flareSpeed,
      anamorphic: sunFlareProps.anamorphic,
      secondaryGhosts: sunFlareProps.secondaryGhosts,
      starBurst: sunFlareProps.starBurst,
      animated: sunFlareProps.animated,
      haloScale: sunFlareProps.haloScale,
      ghostScale: sunFlareProps.ghostScale,
      initialColor: sunFlareProps.colorGain,
    }),
    // Stable at mount — color animates via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const moonFlareConfig = useMemo(
    () => ({
      glareSize: moonFlareProps.glareSize,
      flareSize: moonFlareProps.flareSize,
      starPoints: moonFlareProps.starPoints,
      flareSpeed: moonFlareProps.flareSpeed,
      anamorphic: moonFlareProps.anamorphic,
      secondaryGhosts: moonFlareProps.secondaryGhosts,
      starBurst: moonFlareProps.starBurst,
      animated: moonFlareProps.animated,
      haloScale: moonFlareProps.haloScale,
      ghostScale: moonFlareProps.ghostScale,
      initialColor: moonFlareProps.colorGain,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    const sunDir = atmosphere?.transientStates?.sunDirection;
    const moonDir = atmosphere?.transientStates?.moonDirection;

    const ecefToWorld = ecefToWorldRef.current;
    const scratch = worldDirScratch.current;

    if (sunDir && (sunDir.x !== 0 || sunDir.y !== 0 || sunDir.z !== 0)) {
      scratch.copy(sunDir).transformDirection(ecefToWorld);
      const sx = scratch.x * SUN_DISTANCE;
      const sy = scratch.y * SUN_DISTANCE;
      const sz = scratch.z * SUN_DISTANCE;
      sceneRefs.sunWorldPosRef.current.set(sx, sy, sz);
      const sunMesh = sceneRefs.sunMeshRef.current;
      if (sunMesh) {
        sunMesh.position.set(sx, sy, sz);
        sunPositionedRef.current = true;
        sunMesh.visible = gates.sunVisible > 0 && sunPositionedRef.current;
      }
    }
    if (moonDir && (moonDir.x !== 0 || moonDir.y !== 0 || moonDir.z !== 0)) {
      scratch.copy(moonDir).transformDirection(ecefToWorld);
      const mx = scratch.x * MOON_DISTANCE;
      const my = scratch.y * MOON_DISTANCE;
      const mz = scratch.z * MOON_DISTANCE;
      sceneRefs.moonWorldPosRef.current.set(mx, my, mz);
      const moonMesh = sceneRefs.moonMeshRef.current;
      if (moonMesh) {
        moonMesh.position.set(mx, my, mz);
        moonMesh.visible = gates.moonVisible > 0;
      }
    }

    const targetCover = config.cloudCover ?? 0;
    const cov = coverageLerpRef.current;
    coverageLerpRef.current =
      cov + (targetCover - cov) * (1 - Math.exp(-delta / 3));
    const coverage = coverageLerpRef.current;
    const coverAtten = 1 - Math.min(1, coverage * 1.1);
    // Cap at 0.6 so the flare reads as an element rather than a scene-wide
    // warm wash. The LensFlareEffect's halo and ghosts are additive in
    // screen space, so full opacity compounds with sky colour and clips.
    sunOpacityRef.current = gates.sunVisible * coverAtten * 0.6;
    moonOpacityRef.current = gates.moonVisible * coverAtten * 0.6;
  });

  return (
    <>
      {SUN_SPRITE_ENABLED && <SunSprite onReady={setSunMesh} />}
      <EffectComposer enableNormalPass multisampling={0}>
        {/*
          DIAGNOSTIC: Clouds temporarily disabled. The "scene visible for a
          second then dark overlay" timing matches @takram/three-clouds
          finishing its texture load (~1s from GitHub CDN) and then piping
          its `atmosphereOverlay` / `atmosphereShadow` / `shadowLength` into
          AerialPerspective, which composites them into the sky. If the sky
          renders cleanly with this disabled, cloud config (layer heights,
          coverage, shadow) needs tuning; re-enable and tune from there.
        */}
        {CLOUDS_ENABLED ? (
          <Clouds
            qualityPreset={preset.cloudsPreset}
            resolutionScale={preset.resolutionScale}
            coverage={cloudsProps.coverage}
            localWeatherVelocity={cloudsProps.localWeatherVelocity}
            shapeVelocity={cloudsProps.shapeVelocity}
            shapeDetailVelocity={cloudsProps.shapeDetailVelocity}
          />
        ) : (
          <></>
        )}
        {/*
          `sunLight` / `skyLight` enable post-process lighting of scene
          geometry via the normal buffer. They're not needed for the sky
          itself and can produce dark framings at low camera altitudes.
          Just render the sky and atmospheric transmittance.
        */}
        <AerialPerspective sky />
        {/*
          AerialPerspective outputs HDR radiance values (a physically-based
          atmospheric scattering model; see the library's vanilla example in
          README.md line ~203 that pairs it with a ToneMappingEffect). Without
          tone mapping, those HDR values get clamped component-wise and the
          sky renders as uniformly dark once the precomputed textures finish
          generating. AGX gives a filmic roll-off suitable for physical sky.
        */}
        <ToneMapping mode={ToneMappingMode.AGX} />
        {GOD_RAYS_ENABLED && preset.godRaysEnabled && sunMesh ? (
          <GodRays
            sun={sunMesh}
            samples={preset.godRaysSamples}
            density={0.9}
            decay={0.93}
            weight={0.4}
            exposure={0.3}
            clampMax={1}
            blur
          />
        ) : (
          <></>
        )}
        {LENS_FLARE_ENABLED ? (
          <BodyLensFlare
            worldPositionRef={sceneRefs.sunWorldPosRef}
            opacityRef={sunOpacityRef}
            colorGainRef={sunColorRef}
            config={sunFlareConfig}
          />
        ) : (
          <></>
        )}
        {LENS_FLARE_ENABLED && preset.moonFlareEnabled ? (
          <BodyLensFlare
            worldPositionRef={sceneRefs.moonWorldPosRef}
            opacityRef={moonOpacityRef}
            colorGainRef={moonColorRef}
            config={moonFlareConfig}
          />
        ) : (
          <></>
        )}
      </EffectComposer>
    </>
  );
}

export function VolumetricClouds({ config }: VolumetricCloudsProps) {
  const atmosphereDate = useMemo(() => {
    const dt = config.dt ?? (config.sunrise + config.sunset) / 2;
    return new Date(dt * 1000);
  }, [config.dt, config.sunrise, config.sunset]);

  // Load precomputed atmosphere LUTs from the library's CDN instead of
  // letting Atmosphere create a PrecomputedTexturesGenerator. The generator
  // is async, runs over multiple frames, AND in React 19 StrictMode its
  // useEffect cleanup fires dispose() mid-generation (see
  // PrecomputedTexturesGenerator.ts:759 — dispose() queues itself if updating,
  // then runs after update finishes; meanwhile the effect re-mounts and
  // calls update() again on the same instance). That race produces the
  // "looks fine at first render then collapses to black after ~1s"
  // transition: the first frame uses whatever texture state is in-flight,
  // and once the post-race generator settles the LUTs are corrupt.
  // Loading from CDN skips the generator entirely — textures are either
  // loaded (correct) or not loaded (nothing rendered).
  //
  // `ground: false` disables the ellipsoid ground rendering. We don't render
  // a planet surface (this is a local weather scene), so leaving it on fills
  // the lower half of the view with opaque Earth-surface color.
  return (
    <Atmosphere
      date={atmosphereDate}
      ground={false}
      textures={DEFAULT_PRECOMPUTED_TEXTURES_URL}
    >
      <SceneInsideAtmosphere config={config} />
    </Atmosphere>
  );
}

export const MOON_MESH_RADIUS = MOON_RADIUS;
