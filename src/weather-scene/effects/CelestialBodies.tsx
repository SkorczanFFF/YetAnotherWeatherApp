import { useContext, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { AtmosphereContext } from "@takram/three-atmosphere/r3f";
import type { SimulationConfig } from "../types";
import { useSceneRefsRequired } from "../SceneRefsContext";
import { getTimeGates } from "./internal/flareProps";

const SUN_DISTANCE = 1000;
const MOON_DISTANCE = 1000;
const SUN_GLOW_RADIUS = 9;
const MOON_RADIUS = 4;

interface CelestialBodiesProps {
  config: SimulationConfig;
}

/**
 * Sun glow sphere + textured moon billboard. Both meshes start invisible and
 * only flip `visible = true` once (a) the ECEF→world direction transform has
 * produced a real sky position, and (b) the current time-of-day gate permits
 * it. Skipping either guard reproduces the "moon flashes at screen centre
 * then disappears" bug, because meshes default to position=(0,0,0) on mount
 * — right where the camera sits.
 */
export function CelestialBodies({ config }: CelestialBodiesProps) {
  const sceneRefs = useSceneRefsRequired();
  const atmosphere = useContext(AtmosphereContext);
  const moonMap = useLoader(THREE.TextureLoader, "/effects/moon.jpg");

  const gates = useMemo(
    () => getTimeGates(config.timeOfDay, config.thunderstorm),
    [config.timeOfDay, config.thunderstorm],
  );

  const ecefToWorldRef = useRef(new THREE.Matrix4());
  const worldDirScratch = useRef(new THREE.Vector3());
  const sunPositionedRef = useRef(false);
  const moonPositionedRef = useRef(false);

  const setSunRef = useRef((el: THREE.Mesh | null) => {
    sceneRefs.sunMeshRef.current = el;
  }).current;

  const setMoonRef = useRef((el: THREE.Mesh | null) => {
    sceneRefs.moonMeshRef.current = el;
  }).current;

  useFrame(() => {
    const worldToEcef = atmosphere?.transientStates?.worldToECEFMatrix;
    if (!worldToEcef) return;
    // Kept up to date every frame rather than cached on mount: the scene-wide
    // matrix can be overwritten between effect cleanup and re-install when
    // the Atmosphere subtree remounts (StrictMode, HMR).
    ecefToWorldRef.current.copy(worldToEcef).invert();
    const ecefToWorld = ecefToWorldRef.current;
    const scratch = worldDirScratch.current;

    const sunDir = atmosphere?.transientStates?.sunDirection;
    if (sunDir && (sunDir.x !== 0 || sunDir.y !== 0 || sunDir.z !== 0)) {
      scratch.copy(sunDir).transformDirection(ecefToWorld);
      const sx = scratch.x * SUN_DISTANCE;
      const sy = scratch.y * SUN_DISTANCE;
      const sz = scratch.z * SUN_DISTANCE;
      sceneRefs.sunWorldPosRef.current.set(sx, sy, sz);
      const sunMesh = sceneRefs.sunMeshRef.current;
      if (sunMesh) {
        sunMesh.position.set(sx, sy, sz);
        sunPositionedRef.current = true;
        sunMesh.visible = gates.sunVisible > 0 && sunPositionedRef.current;
      }
    }

    const moonDir = atmosphere?.transientStates?.moonDirection;
    if (moonDir && (moonDir.x !== 0 || moonDir.y !== 0 || moonDir.z !== 0)) {
      scratch.copy(moonDir).transformDirection(ecefToWorld);
      const mx = scratch.x * MOON_DISTANCE;
      const my = scratch.y * MOON_DISTANCE;
      const mz = scratch.z * MOON_DISTANCE;
      sceneRefs.moonWorldPosRef.current.set(mx, my, mz);
      const moonMesh = sceneRefs.moonMeshRef.current;
      if (moonMesh) {
        moonMesh.position.set(mx, my, mz);
        moonPositionedRef.current = true;
        moonMesh.visible = gates.moonVisible > 0 && moonPositionedRef.current;
      }
    }
  });

  return (
    <>
      {/* Sun glow sphere. Also used as the GodRays source mesh. */}
      <mesh ref={setSunRef} frustumCulled={false} visible={false}>
        <sphereGeometry args={[SUN_GLOW_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color={0xffb347}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      {/* Moon billboard. Starts hidden; CelestialBodies flips visibility
          once position is set AND the time-of-day gate allows. */}
      <mesh ref={setMoonRef} frustumCulled={false} visible={false}>
        <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
        <meshBasicMaterial
          map={moonMap}
          color={0xf8f8ff}
          depthWrite
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </>
  );
}

export const MOON_MESH_RADIUS = MOON_RADIUS;
