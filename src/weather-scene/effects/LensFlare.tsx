import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { SimulationConfig } from "../types";
import { useSceneRefsRequired } from "../SceneRefsContext";
import { BodyLensFlare } from "./internal/BodyLensFlare";
import {
  buildSunFlareProps,
  buildMoonFlareProps,
  getTimeGates,
} from "./internal/flareProps";
import { detectQualityTier, getRuntimePreset } from "./internal/qualityPreset";

interface LensFlareProps {
  config: SimulationConfig;
}

/**
 * Sun + moon lens flare passes. Opacity per body blends three factors —
 * time-of-day gate (sun during day / moon at night), cloud-cover attenuation
 * (heavy overcast dims both flares), and a small global ceiling to keep the
 * halo from washing the sky. Colour for the sun lerps warm → white as cover
 * increases; the moon stays cool blue-white.
 */
export function LensFlare({ config }: LensFlareProps) {
  const sceneRefs = useSceneRefsRequired();

  const preset = useMemo(() => getRuntimePreset(detectQualityTier()), []);
  const sunFlareProps = useMemo(() => buildSunFlareProps(config), [config]);
  const moonFlareProps = useMemo(() => buildMoonFlareProps(), []);

  const gates = useMemo(
    () => getTimeGates(config.timeOfDay, config.thunderstorm),
    [config.timeOfDay, config.thunderstorm],
  );

  const sunOpacityRef = useRef(0);
  const moonOpacityRef = useRef(0);
  const sunColorRef = useRef(sunFlareProps.colorGain.clone());
  const moonColorRef = useRef(moonFlareProps.colorGain.clone());

  // Target colour tracks config.cloudCover; ref copy lets BodyLensFlare's
  // per-frame uniform write pull without re-rendering this component.
  useEffect(() => {
    sunColorRef.current.copy(sunFlareProps.colorGain);
  }, [sunFlareProps]);
  useEffect(() => {
    moonColorRef.current.copy(moonFlareProps.colorGain);
  }, [moonFlareProps]);

  // Effect configs are captured at mount — the underlying LensFlareEffect
  // is memoised on construction, and we drive runtime values (opacity,
  // colour) through refs above.
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

  const coverageLerpRef = useRef(config.cloudCover ?? 0);

  useFrame((_state, delta) => {
    const targetCover = config.cloudCover ?? 0;
    const cov = coverageLerpRef.current;
    coverageLerpRef.current =
      cov + (targetCover - cov) * (1 - Math.exp(-delta / 3));
    const coverAtten = 1 - Math.min(1, coverageLerpRef.current * 1.1);
    // 0.6 ceiling keeps the halo from reading as a scene-wide warm wash —
    // LensFlareEffect's halo/ghosts are additive in screen space.
    sunOpacityRef.current = gates.sunVisible * coverAtten * 0.6;
    moonOpacityRef.current = gates.moonVisible * coverAtten * 0.6;
  });

  return (
    <>
      <BodyLensFlare
        worldPositionRef={sceneRefs.sunWorldPosRef}
        opacityRef={sunOpacityRef}
        colorGainRef={sunColorRef}
        config={sunFlareConfig}
      />
      {preset.moonFlareEnabled ? (
        <BodyLensFlare
          worldPositionRef={sceneRefs.moonWorldPosRef}
          opacityRef={moonOpacityRef}
          colorGainRef={moonColorRef}
          config={moonFlareConfig}
        />
      ) : null}
    </>
  );
}
