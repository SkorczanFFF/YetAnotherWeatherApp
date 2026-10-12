import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Matrix3, Matrix4, Scene, Vector2, Vector3 } from "three";
import {
  AerialPerspective,
  Atmosphere,
  type AtmosphereApi,
} from "@takram/three-atmosphere/r3f";
import {
  CloudShape,
  CloudShapeDetail,
  type CloudsQualityPreset,
  LocalWeather,
  Turbulence,
} from "@takram/three-clouds";
import { CloudLayer, Clouds } from "@takram/three-clouds/r3f";
import { Ellipsoid, Geodetic } from "@takram/three-geospatial";
import type { QualityTier, SceneParams } from "../../weather/sceneParams";
import { useSceneSignals } from "../core/sceneSignals";
import {
  CLOUD_TIMELAPSE,
  compassToWorld,
  directionFromRelative,
  facingFor,
  windVelocity,
} from "../core/worldFrame";
import { shellTargets } from "../layers/VolumetricClouds";

// ---------------------------------------------------------------------------
// TEST ONLY (branch clouds-takram-test): @takram/three-clouds +
// three-atmosphere as an alternative to our own volumetric clouds, switchable
// from the debug menu. Lazy-loaded so the regular bundle doesn't carry it.
//
// - Our world (camera at the origin, -Z = facing south/north, +Y up) is placed
//   on the WGS84 ellipsoid at the weather location via worldToECEFMatrix;
//   takram treats world units as metres, which is harmless here because the
//   default rig never moves the camera more than ~1.5 units off the origin.
// - Sun and moon: on-screen azimuth + real altitude — the same compromise our
//   own clouds use — written over the date-derived directions every frame.
// - EffectComposer + AerialPerspective(sky) repaint every background pixel,
//   which would wipe particles that don't write depth. Precipitation, bolts and
//   diamond dust therefore render in an overlay scene after the composer.
// ---------------------------------------------------------------------------

const ASSETS = "/takram";
const STBN = `${ASSETS}/stbn.bin`;
/** Observer altitude above the ellipsoid, m. */
const OBSERVER_ALTITUDE = 10;
/** takram's default repeat values — velocities are in those texture units/s. */
const SHAPE_REPEAT = 0.0003;
const SHAPE_DETAIL_REPEAT = 0.006;
/** Local weather tiles 100× per cube-sphere edge ≈ one tile per 100 km. */
const LOCAL_WEATHER_TILE_M = 100_000;
/** Physical radiance → display; tuned by eye against the NEUTRAL curve. */
const EXPOSURE = 6;

const PRESETS: Record<QualityTier, { preset: CloudsQualityPreset; scale: number }> = {
  high: { preset: "high", scale: 1 },
  medium: { preset: "medium", scale: 0.75 },
  low: { preset: "low", scale: 0.5 },
  potato: { preset: "low", scale: 0.35 },
};

interface TakramSkyProps {
  params: SceneParams;
  tier: QualityTier;
  /** Rendered after the composer, on top (precipitation, bolts, sparkles). */
  overlay: ReactNode;
}

/** world → ECEF: our axes (north/east from compassToWorld, +Y up) onto the local NUE frame. */
function worldToECEF(lat: number, lon: number, target: Matrix4): Matrix4 {
  const surface = new Geodetic(
    (lon * Math.PI) / 180,
    (lat * Math.PI) / 180,
    OBSERVER_ALTITUDE,
  ).toECEF();
  const nue = Ellipsoid.WGS84.getNorthUpEastFrame(surface, new Matrix4());
  const facing = facingFor(lat);
  const world = new Matrix4().makeBasis(
    compassToWorld(0, facing),
    new Vector3(0, 1, 0),
    compassToWorld(90, facing),
  );
  // nue · worldᵀ maps world north/up/east onto ECEF north/up/east; the
  // translation stays at the surface point.
  return target.multiplyMatrices(nue, world.transpose());
}

export function TakramSky({ params, tier, overlay }: TakramSkyProps) {
  const s = useSceneSignals();
  const gl = useThree((state) => state.gl);
  const atmosphere = useRef<AtmosphereApi>(null);
  const toECEF = useMemo(
    () => worldToECEF(params.lat, params.lon, new Matrix4()),
    [params.lat, params.lon],
  );
  const toECEFLinear = useMemo(() => new Matrix3().setFromMatrix4(toECEF), [toECEF]);
  const scratch = useMemo(() => new Vector3(), []);

  // Procedural textures — generated on the GPU, nothing to download.
  const textures = useMemo(
    () => ({
      localWeather: new LocalWeather(),
      shape: new CloudShape(),
      shapeDetail: new CloudShapeDetail(),
      turbulence: new Turbulence(),
    }),
    [],
  );
  useEffect(
    () => () => {
      textures.localWeather.dispose();
      textures.shape.dispose();
      textures.shapeDetail.dispose();
      textures.turbulence.dispose();
    },
    [textures],
  );

  useEffect(() => {
    const previous = gl.toneMappingExposure;
    gl.toneMappingExposure = EXPOSURE;
    return () => {
      gl.toneMappingExposure = previous;
    };
  }, [gl]);

  useLayoutEffect(() => {
    atmosphere.current?.worldToECEFMatrix.copy(toECEF);
  }, [toECEF]);

  // Priority 0 — runs before the composer (priority 1) reads the states.
  useFrame(() => {
    const api = atmosphere.current;
    if (!api) return;
    api.worldToECEFMatrix.copy(toECEF);
    // Real date for the star field / Earth rotation, then our directions.
    api.updateByDate(params.time ?? Date.now());
    const sunRelAz = Math.atan2(s.sunDir.x, -s.sunDir.z);
    directionFromRelative(sunRelAz, s.sunAlt, scratch);
    api.sunDirection.copy(scratch).applyMatrix3(toECEFLinear).normalize();
    const moonRelAz = Math.atan2(s.moonDir.x, -s.moonDir.z);
    directionFromRelative(moonRelAz, s.moonAlt, scratch);
    api.moonDirection.copy(scratch).applyMatrix3(toECEFLinear).normalize();
  });

  // Weather → takram parameters (static per params; gusts aren't animated).
  const shell = useMemo(() => shellTargets(params), [params]);
  // Clouds drift with the 850 hPa wind from the cloud physics.
  const { windLow } = params.cloudPhysics;
  const motion = useMemo(() => {
    const facing = facingFor(params.lat);
    const drift = windVelocity(windLow.fromDeg, windLow.speedMs, facing)
      .multiplyScalar(CLOUD_TIMELAPSE);
    const driftECEF = drift.clone().applyMatrix3(toECEFLinear);
    const towards = ((windLow.fromDeg + 180) * Math.PI) / 180;
    const speed = drift.length();
    return {
      shape: driftECEF.clone().multiplyScalar(SHAPE_REPEAT),
      detail: driftECEF.clone().multiplyScalar(SHAPE_DETAIL_REPEAT),
      weather: new Vector2(Math.sin(towards), Math.cos(towards)).multiplyScalar(
        speed / LOCAL_WEATHER_TILE_M,
      ),
    };
  }, [params.lat, windLow.fromDeg, windLow.speedMs, toECEFLinear]);

  const { clouds } = params;
  const quality = PRESETS[tier];
  const storm = params.thunder ? 2 : params.precip.rainMmH > 0 ? 1.4 : 1;
  // Second layer's thickness follows the derived cloud depth (CAPE towers).
  const towerHeight = Math.min(9000, Math.max(800, shell.thickness));
  // Near-total cover breaks the cloud shadow cascades here (clouds vanish
  // inside a frustum-shaped band), so overcast skies render without BSM.
  const castShadows = shell.coverage < 0.8;

  return (
    <Atmosphere ref={atmosphere} textures={`${ASSETS}/atmosphere/`}>
      <EffectComposer multisampling={0}>
        <Clouds
          qualityPreset={quality.preset}
          resolutionScale={quality.scale}
          coverage={shell.coverage}
          localWeatherTexture={textures.localWeather}
          shapeTexture={textures.shape}
          shapeDetailTexture={textures.shapeDetail}
          turbulenceTexture={textures.turbulence}
          stbnTexture={STBN}
          localWeatherVelocity={motion.weather}
          shapeVelocity={motion.shape}
          shapeDetailVelocity={motion.detail}
        >
          {/* The library's own default layers (750 m / 1000 m / 7500 m cirrus),
              only patched by the weather: density, storm towers, cirrus. */}
          <CloudLayer index={0} densityScale={0.2 * storm} shadow={castShadows} />
          <CloudLayer index={1} densityScale={0.2 * storm} height={towerHeight} shadow={castShadows} />
          <CloudLayer index={2} densityScale={0.003 * Math.min(1, clouds.high * 2)} />
        </Clouds>
        <AerialPerspective sky stbnTexture={STBN} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
      <OverlayPass>{overlay}</OverlayPass>
    </Atmosphere>
  );
}

/**
 * Renders its children in a separate scene after the EffectComposer
 * (priority 1), straight to the screen, depth cleared — so particles and
 * bolts sit on top of the takram sky instead of being painted over.
 */
function OverlayPass({ children }: { children: ReactNode }) {
  const scene = useMemo(() => new Scene(), []);
  useFrame(({ gl, camera }) => {
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(scene, camera);
    gl.autoClear = autoClear;
  }, 2);
  return createPortal(children, scene);
}
