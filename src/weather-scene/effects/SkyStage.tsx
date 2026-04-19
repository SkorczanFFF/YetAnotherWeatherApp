import { useContext, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import {
  Atmosphere,
  AtmosphereContext,
  AerialPerspective,
} from "@takram/three-atmosphere/r3f";
import { DEFAULT_PRECOMPUTED_TEXTURES_URL } from "@takram/three-atmosphere";
import { Ellipsoid, Geodetic } from "@takram/three-geospatial";
import { EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { SimulationConfig } from "../types";
import { CelestialBodies } from "./CelestialBodies";
import { VolumetricClouds } from "./VolumetricClouds";
import { GodRays } from "./GodRays";
import { LensFlare } from "./LensFlare";

// Scene origin sits ~500 m above the WGS84 ellipsoid at the viewed city's
// (lat, lon). Placing the NUE frame at the actual weather location is what
// makes the atmosphere's sun direction match local solar noon — without this,
// sunrise/sunset would always fire at the equator's schedule. The frame is
// North-Up-East: world +X=north, +Y=up, +Z=east.
const ORIGIN_ALTITUDE = 500;
const DEG2RAD = Math.PI / 180;

interface SkyStageProps {
  config: SimulationConfig;
}

export function SkyStage({ config }: SkyStageProps) {
  // Feed Atmosphere a Date built from either realtime or the pinned config.dt.
  // Falls back to day midpoint so the sky doesn't go dark during early-load
  // frames before the API returns sunrise/sunset.
  const atmosphereDate = useMemo(() => {
    const dt = config.useRealtimeClock
      ? Date.now() / 1000
      : (config.dt ?? (config.sunrise + config.sunset) / 2);
    return new Date(dt * 1000);
  }, [config.useRealtimeClock, config.dt, config.sunrise, config.sunset]);

  // `ground: false` disables the library's planet surface — we're rendering
  // a local weather scene, not an orbital view. Textures come from the CDN
  // to sidestep the React 19 StrictMode race in PrecomputedTexturesGenerator
  // (async multi-frame texture build vs. effect cleanup firing dispose()).
  return (
    <Atmosphere
      date={atmosphereDate}
      ground={false}
      textures={DEFAULT_PRECOMPUTED_TEXTURES_URL}
    >
      <SkyStageInside config={config} />
    </Atmosphere>
  );
}

function SkyStageInside({ config }: SkyStageProps) {
  const atmosphere = useContext(AtmosphereContext);

  const surfaceECEF = useMemo(() => {
    const lat = (config.lat ?? 0) * DEG2RAD;
    const lon = (config.lon ?? 0) * DEG2RAD;
    return new Geodetic(lon, lat, ORIGIN_ALTITUDE).toECEF();
  }, [config.lat, config.lon]);

  // Install the North-Up-East frame synchronously before r3f's render loop
  // starts. useEffect can race with AerialPerspective's first useFrame
  // (which copies the identity matrix into its uniform) and leave the sky
  // looking at Earth's interior. Re-runs when lat/lon changes so selecting
  // a new city re-anchors the sun to that location's local time.
  useLayoutEffect(() => {
    const w = atmosphere?.transientStates?.worldToECEFMatrix;
    if (!w) return;
    Ellipsoid.WGS84.getNorthUpEastFrame(surfaceECEF, w);
  }, [atmosphere, surfaceECEF]);

  return (
    <>
      <CelestialBodies config={config} />
      <EffectComposer enableNormalPass multisampling={0}>
        <VolumetricClouds config={config} />
        <AerialPerspective sky />
        {/* NEUTRAL (Khronos Neutral Tonemap) preserves hues and highlights so
            sunlit clouds can actually read as white. AGX — the prior default —
            is a cinematic curve that desaturates highlights and crushes
            midtones; under AGX the cloud deck rendered uniformly grey even at
            full sun. If you switch back to AGX, expect that look. */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <GodRays />
        <LensFlare config={config} />
      </EffectComposer>
    </>
  );
}
