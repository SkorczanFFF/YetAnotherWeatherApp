import { useLoader } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import { useSceneRefsRequired } from "../SceneRefsContext";

const MOON = {
  size: 4,
  color: 0xf8f8ff,
  textureUrl: "/effects/moon.jpg",
} as const;

interface CelestialBodiesProps {
  config: SimulationConfig;
}

/**
 * Moon billboard only. Sun sprite and all lens-flare / sunlight have moved
 * into `<VolumetricClouds>` so they can share the post-processing composer
 * and consume `<Atmosphere>` sun/moon directions.
 */
export function CelestialBodies({ config: _config }: CelestialBodiesProps) {
  const moonMap = useLoader(THREE.TextureLoader, MOON.textureUrl);
  const sceneRefs = useSceneRefsRequired();
  const setMoonRef = useRef((el: THREE.Mesh | null) => {
    sceneRefs.moonMeshRef.current = el;
  }).current;

  return (
    <mesh ref={setMoonRef} frustumCulled={false}>
      <sphereGeometry args={[MOON.size, 32, 32]} />
      <meshBasicMaterial
        map={moonMap}
        color={MOON.color}
        depthWrite={true}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}
