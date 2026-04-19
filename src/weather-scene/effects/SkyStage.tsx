import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AerialPerspective,
  Atmosphere,
  AtmosphereContext,
  Stars,
  type AtmosphereApi,
} from "@takram/three-atmosphere/r3f";
import { DEFAULT_PRECOMPUTED_TEXTURES_URL } from "@takram/three-atmosphere";
import { Ellipsoid, Geodetic } from "@takram/three-geospatial";
import { EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { SimulationConfig } from "../types";
import { VolumetricClouds } from "./VolumetricClouds";

// Camera origin sits ~500 m above WGS84 at the viewed city. Setting the NUE
// matrix on the atmosphere context ties its sun/moon direction to that
// city's local time — without this the atmosphere always paints the (0,0)
// schedule of equatorial Africa.
const ORIGIN_ALTITUDE = 500;
const DEG2RAD = Math.PI / 180;

interface SkyStageProps {
  config: SimulationConfig;
}

/**
 * Canonical @takram/three-atmosphere + @takram/three-clouds environment.
 *
 * Mirrors the official `Clouds-Basic` Storybook story
 * (https://github.com/takram-design-engineering/three-geospatial/blob/main/storybook/src/clouds/Clouds-Basic.tsx)
 * with two project-specific additions:
 *   1. `worldToECEFMatrix` is installed manually in `useLayoutEffect` so
 *      sun/moon direction reflects the viewed city's lat/lon (the canonical
 *      Storybook story wraps scene meshes in `<EastNorthUpFrame>` instead,
 *      but we use a flat camera-relative scene origin).
 *   2. The atmosphere date is fed from `SimulationConfig` (real-time clock
 *      or pinned `dt` from a debug override) rather than a Storybook
 *      motionDate.
 *
 * Composer order, AerialPerspective `sky/sun/moon/sunLight/skyLight` flags,
 * ToneMapping AGX, no MSAA + normalPass — all match the canonical setup.
 * CloudsEffect uses library defaults (4-layer stack 750–8500 m, default
 * raymarch budget, default sky/ground light scale, default qualityPreset).
 */
export function SkyStage({ config }: SkyStageProps) {
  const atmosphereRef = useRef<AtmosphereApi | null>(null);

  // Canonical date-update pattern: ref + per-frame `updateByDate(...)`.
  // Avoids the prop-driven `useEffect` rerun on every config change.
  useFrame(() => {
    const api = atmosphereRef.current;
    if (!api) return;
    const dt = config.useRealtimeClock
      ? Date.now() / 1000
      : (config.dt ?? (config.sunrise + config.sunset) / 2);
    api.updateByDate(new Date(dt * 1000));
  });

  return (
    <Atmosphere
      ref={atmosphereRef}
      correctAltitude
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

  // Install the North-Up-East frame synchronously before R3F's render loop —
  // useEffect would race AerialPerspective's first useFrame and leave the
  // sky looking at Earth's interior.
  useLayoutEffect(() => {
    const w = atmosphere?.transientStates?.worldToECEFMatrix;
    if (!w) return;
    Ellipsoid.WGS84.getNorthUpEastFrame(surfaceECEF, w);
  }, [atmosphere, surfaceECEF]);

  return (
    <>
      {/* Real catalogue stars from `@takram/three-atmosphere/r3f`. They're
          rendered as a points cloud anchored to the ECI frame, so they
          rotate slowly with sidereal time and dim out automatically as the
          sun approaches the horizon. Without this the night sky reads as
          pure black under AGX (the atmospheric scattering integral
          collapses to zero radiance after astronomical twilight). */}
      <Stars />
      <EffectComposer multisampling={0} enableNormalPass>
        <VolumetricClouds config={config} />
        {/* `lunarRadianceScale={16}` is a cinematic cheat — physical
            moonlight is ~400,000× dimmer than sunlight, which under AGX
            tonemapping reads as imperceptible. 16× lifts moonlit nights
            (when the moon is above horizon) firmly into the visible range
            without looking obviously fake. Has no effect when the moon is
            below horizon: the shader still won't render the disc and the
            moon-illuminated scattering integrals still sum to 0 — that
            case is handled by the cloud-side `skyLightScale` boost in
            VolumetricClouds.tsx. */}
        <AerialPerspective
          sky
          sun
          moon
          sunLight
          skyLight
          lunarRadianceScale={16}
        />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </>
  );
}
