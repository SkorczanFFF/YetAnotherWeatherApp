import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { FogExp2 } from "three";
import { useSceneSignals } from "../core/sceneSignals";

/**
 * Scene FogExp2 in the horizon colour, density from visibility. Mounted only with the
 * potato-tier <CloudDeck>, its one user (`fog: true`); sky and volumetrics do their own haze.
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
