import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";
import { getSunProgress } from "../../weather/config";

/** Above cloud layer (clouds use spawnYMax up to ~14). */
const SUN_MOON_Y = 24;
const SUN_MOON_Z = -43;
const CAMERA_DISTANCE = 5;

const SUN_COLOR = 0xffdd44;
const SUN_SIZE = 2;
const MOON_COLOR = 0xe8e8e8;
const MOON_SIZE = 1.5;

function getXEdge(camera: THREE.PerspectiveCamera): number {
  const depth = Math.abs(SUN_MOON_Z - CAMERA_DISTANCE);
  const fovRad = (camera.fov * Math.PI) / 180;
  return Math.tan(fovRad / 2) * depth * camera.aspect;
}

interface SunMoonEffectProps {
  config: SimulationConfig;
}

export function SunMoonEffect({ config }: SunMoonEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const group = groupRef.current;
    const sunMesh = sunMeshRef.current;
    const moonMesh = moonMeshRef.current;
    if (!group || !sunMesh || !moonMesh) return;

    const camera = state.camera as THREE.PerspectiveCamera;
    const currentDt = config.useRealtimeClock
      ? Date.now() / 1000
      : (config.dt ?? (config.sunrise + config.sunset) / 2);

    const sunProgress = getSunProgress(
      currentDt,
      config.sunrise,
      config.sunset,
    );
    const xEdge = getXEdge(camera);
    const sunX = -xEdge + sunProgress * 2 * xEdge;
    const moonX = -xEdge + (1 - sunProgress) * 2 * xEdge;

    sunMesh.position.set(sunX, SUN_MOON_Y, SUN_MOON_Z);
    moonMesh.position.set(moonX, SUN_MOON_Y, SUN_MOON_Z);

    const showSun =
      config.timeOfDay === "day" ||
      config.timeOfDay === "dawn" ||
      config.timeOfDay === "dusk";
    const showMoon =
      config.timeOfDay === "night" ||
      config.timeOfDay === "dawn" ||
      config.timeOfDay === "dusk";

    sunMesh.visible = showSun;
    moonMesh.visible = showMoon;
  });

  return (
    <group ref={groupRef}>
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[SUN_SIZE, 32, 32]} />
        <meshBasicMaterial
          color={SUN_COLOR}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[MOON_SIZE, 32, 32]} />
        <meshBasicMaterial
          color={MOON_COLOR}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
