import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { FogExp2 } from "three";
import { useSceneSignals } from "../core/sceneSignals";

/**
 * Scene-wide FogExp2: colour = current horizon colour, density from
 * visibility (SceneDriver). Mounted only alongside the potato-tier
 * <CloudDeck>, the one material that opts in (`fog: true`); the sky's own
 * haze lives in SkyGrade, and the volumetric clouds do their own aerial
 * perspective.
 */
export function FogLayer() {
  const s = useSceneSignals();
  const scene = useThree((state) => state.scene);
  const fog = useMemo(() => new FogExp2(s.horizonColor.getHex(), s.fogDensity), [s]);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(() => {
    fog.color.copy(s.horizonColor);
    fog.density = s.fogDensity;
  });

  return null;
}
