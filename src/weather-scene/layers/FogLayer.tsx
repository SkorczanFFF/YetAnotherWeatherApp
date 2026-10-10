import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { FogExp2 } from "three";
import { useSceneSignals } from "../core/sceneSignals";

/**
 * Scene-wide FogExp2: colour = current horizon colour, density from
 * visibility (SceneDriver). Only the potato-tier <CloudDeck> opts in
 * (`fog: true`); particles and bolts opt out. The sky's own haze lives in
 * SkyGrade, so this costs no draw call.
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
