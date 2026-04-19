import { useMemo } from "react";
import { Clouds, CloudLayer } from "@takram/three-clouds/r3f";
import type { SimulationConfig } from "../types";
import { buildCloudsProps } from "./internal/cloudProps";
import { detectQualityTier, getRuntimePreset } from "./internal/qualityPreset";

interface VolumetricCloudsProps {
  config: SimulationConfig;
}

// Scene origin is ~500 m above the WGS84 surface (see SkyStage). CloudLayer
// altitudes are absolute meters above that surface, so a layer at 560 m sits
// 60 m above the camera origin — close enough to be clearly framed in a 75°
// FOV shot that looks horizontally toward (0,0,0), small enough to make the
// raymarched volume cheap. The default CloudLayers.DEFAULT spans 750–8500 m
// with a cirrus deck at 7500 m, which is expensive AND barely in view at the
// current camera's tiny parallax range.
const LOW_CLOUD_ALTITUDE = 560;
const LOW_CLOUD_HEIGHT = 120;
const LOW_CLOUD_BASE_DENSITY = 0.18;
const MID_CLOUD_ALTITUDE = 720;
const MID_CLOUD_HEIGHT = 160;
const MID_CLOUD_BASE_DENSITY = 0.15;
// maxRayDistance caps how far the primary cloud raymarch travels before it
// terminates. Default is 2e5 m (200 km horizon); we only have a ~300 m-thick
// cloud band directly overhead, so clamping cuts many wasted iterations with
// no visible change. The low-tier value is tighter still — fewer iterations
// per pixel is the single biggest lever on Iris Xe / UHD integrated GPUs.
const MAX_RAY_DISTANCE_LOW = 4000;
const MAX_RAY_DISTANCE_DEFAULT = 8000;
// Boost the cloud self-lighting terms so clouds read as white/bright under
// the Neutral tonemap. Library defaults sit around 1.0 for both, tuned
// against an accurate-scattering path; low tier disables
// `accurateSunSkyLight` and caps sun/ground iterations to 1/0, so ambient
// terms take over from direct sun as the dominant brightness contributor.
// Bumping these is cheaper than turning the expensive flags back on.
const SKY_LIGHT_SCALE_LOW = 2.0;
const SKY_LIGHT_SCALE_DEFAULT = 1.5;
const GROUND_BOUNCE_SCALE = 1.4;

/**
 * @takram/three-clouds pass. Runs inside the EffectComposer in SkyStage so
 * clouds composite against the AerialPerspective-generated sky. Coverage and
 * density come from `internal/cloudTiers.ts`, which shapes the linear
 * `config.cloudCover` into anchor-driven visual states (clear / broken /
 * overcast) with smooth interpolation between them. When cloudCover ≤ 0.05
 * the tier returns zero coverage so this pass contributes no visible mass.
 */
export function VolumetricClouds({ config }: VolumetricCloudsProps) {
  const preset = useMemo(() => getRuntimePreset(detectQualityTier()), []);
  const cloudsProps = useMemo(() => buildCloudsProps(config), [config]);
  const isLow = preset.tier === "low";
  // One slab on integrated GPUs, two on discrete. Each CloudLayer adds its
  // own [altitude, altitude+height] interval to the raymarch — the library
  // packs up to 3 intervals into CloudsMaterial uniforms and iterates each
  // one, so trimming to a single slab is a direct ~50% cut of the dominant
  // fragment-shader cost. The visual difference at this altitude range is
  // minimal; the lower slab is the dominant contribution anyway.
  const maxRayDistance = isLow ? MAX_RAY_DISTANCE_LOW : MAX_RAY_DISTANCE_DEFAULT;
  const skyLightScale = isLow ? SKY_LIGHT_SCALE_LOW : SKY_LIGHT_SCALE_DEFAULT;
  // Fold the second layer's density into the first when it's disabled so
  // the sky doesn't visually thin out on low tier.
  const lowDensityScale =
    (LOW_CLOUD_BASE_DENSITY + (isLow ? MID_CLOUD_BASE_DENSITY * 0.5 : 0)) *
    cloudsProps.densityScale;

  return (
    <Clouds
      qualityPreset={preset.cloudsPreset}
      resolutionScale={preset.resolutionScale}
      coverage={cloudsProps.coverage}
      localWeatherVelocity={cloudsProps.localWeatherVelocity}
      shapeVelocity={cloudsProps.shapeVelocity}
      shapeDetailVelocity={cloudsProps.shapeDetailVelocity}
      clouds-maxRayDistance={maxRayDistance}
      skyLightScale={skyLightScale}
      groundBounceScale={GROUND_BOUNCE_SCALE}
      disableDefaultLayers
    >
      <CloudLayer
        index={0}
        channel="r"
        altitude={LOW_CLOUD_ALTITUDE}
        height={LOW_CLOUD_HEIGHT}
        densityScale={lowDensityScale}
        shapeAmount={1.2}
        shadow={false}
      />
      {!isLow && (
        <CloudLayer
          index={1}
          channel="g"
          altitude={MID_CLOUD_ALTITUDE}
          height={MID_CLOUD_HEIGHT}
          densityScale={MID_CLOUD_BASE_DENSITY * cloudsProps.densityScale}
          shapeAmount={1}
          shadow={false}
        />
      )}
    </Clouds>
  );
}
