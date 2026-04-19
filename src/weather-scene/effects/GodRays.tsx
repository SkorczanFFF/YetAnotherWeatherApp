import { useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GodRays as GodRaysPass } from "@react-three/postprocessing";
import * as THREE from "three";
import { useSceneRefsRequired } from "../SceneRefsContext";
import { detectQualityTier, getRuntimePreset } from "./internal/qualityPreset";

/**
 * God rays from the sun sprite. Reads the sun mesh once it's mounted in
 * CelestialBodies, then feeds it to postprocessing's GodRays pass. Disabled
 * on the low preset to preserve mobile frame budget.
 */
export function GodRays() {
  const sceneRefs = useSceneRefsRequired();
  const preset = useMemo(() => getRuntimePreset(detectQualityTier()), []);
  const [sunMesh, setSunMesh] = useState<THREE.Mesh | null>(null);

  // Ref-to-state bridge: we need the mesh object at composition time so the
  // GodRaysPass can bind to it, but sunMeshRef is set imperatively in
  // CelestialBodies via a ref callback. Checking every frame until resolved
  // is negligible cost (one pointer compare) and avoids plumbing an
  // onSunReady callback through SkyStage.
  useFrame(() => {
    if (sunMesh) return;
    const current = sceneRefs.sunMeshRef.current;
    if (current) setSunMesh(current);
  });

  if (!preset.godRaysEnabled || !sunMesh) return null;

  return (
    <GodRaysPass
      sun={sunMesh}
      samples={preset.godRaysSamples}
      density={0.9}
      decay={0.93}
      weight={0.4}
      exposure={0.3}
      clampMax={1}
      blur
    />
  );
}
