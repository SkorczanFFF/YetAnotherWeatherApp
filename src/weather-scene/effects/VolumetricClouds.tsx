import { useMemo } from "react";
import { Clouds } from "@takram/three-clouds/r3f";
import type { SimulationConfig } from "../types";
import { buildCloudsProps } from "./internal/cloudProps";

interface VolumetricCloudsProps {
  config: SimulationConfig;
}

// Cloud shading from @takram/three-clouds blends three terms:
//   - DIRECT sun contribution from `sunDirection` × precomputed sun light
//   - SKY-LIGHT contribution: integrated atmospheric radiance × `skyLightScale`
//   - GROUND-BOUNCE: ground albedo × atmospheric transmittance × `groundBounceScale`
// At deep night the sun term collapses to zero (sun is well below horizon),
// the moon is not consumed for direct lighting, and the sky-scattering
// integrals are tiny — under AGX tonemap clouds render pure black.
//
// Bumping `skyLightScale` at night lifts the sky-light term so even dim
// atmospheric/moonlit radiance is enough to silhouette the cloud deck.
// This is a viewer-friendly deviation from physical accuracy: in true
// rural darkness clouds *are* invisible, but for an urban Katowice
// observer light pollution would lift them. We approximate that here.
const NIGHT_SKY_LIGHT_SCALE = 4.0;
const TWILIGHT_SKY_LIGHT_SCALE = 2.0;
const DAY_SKY_LIGHT_SCALE = 1.0; // library default

/**
 * Canonical @takram/three-clouds setup with one viewer-friendly tweak:
 * `skyLightScale` is keyed off `config.timeOfDay` so the cloud deck
 * remains visible at night when direct sun illumination is zero. Library
 * defaults are used for everything else (4-layer stack, default raymarch
 * budget, default qualityPreset, default groundBounceScale, default
 * scatteringCoefficient).
 */
export function VolumetricClouds({ config }: VolumetricCloudsProps) {
  const cloudsProps = useMemo(() => buildCloudsProps(config), [config]);
  const skyLightScale =
    config.timeOfDay === "night"
      ? NIGHT_SKY_LIGHT_SCALE
      : config.timeOfDay === "dawn" || config.timeOfDay === "dusk"
        ? TWILIGHT_SKY_LIGHT_SCALE
        : DAY_SKY_LIGHT_SCALE;
  return (
    <Clouds
      coverage={cloudsProps.coverage}
      localWeatherVelocity={cloudsProps.localWeatherVelocity}
      shapeVelocity={cloudsProps.shapeVelocity}
      shapeDetailVelocity={cloudsProps.shapeDetailVelocity}
      skyLightScale={skyLightScale}
    />
  );
}
