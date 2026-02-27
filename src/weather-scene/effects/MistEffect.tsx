import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import { MIST_WIND_FACTOR } from "../physics/constants";

const MIST_SPAWN = { x: 0, y: 2, z: -2 };
const MIST_RECYCLE = { xMin: -18, xMax: 18, zMin: -14, zMax: 10 };
const NUM_MIST = 6;

interface MistEffectProps {
  config: SimulationConfig;
}

export function MistEffect({ config }: MistEffectProps) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const geom = new THREE.PlaneGeometry(40, 25);
    for (let i = 0; i < NUM_MIST; i++) {
      const mist = new THREE.Mesh(
        geom.clone(),
        new THREE.MeshBasicMaterial({
          color: 0xcccccc,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mist.position.set(
        MIST_SPAWN.x + (Math.random() - 0.5) * 4,
        MIST_SPAWN.y + (Math.random() - 0.5) * 2,
        MIST_SPAWN.z + (Math.random() - 0.5) * 4,
      );
      mist.rotation.x = Math.random() * 0.5;
      mist.rotation.z = Math.random() * 0.3;
      group.add(mist);
    }
    geom.dispose();

    return () => {
      group.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      group.clear();
    };
  }, []);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const showMist = (config.fogDensity ?? 0) > 0.02;
    group.visible = showMist;
    if (!showMist) return;

    const windDir = (config.windDirection * Math.PI) / 180;
    const windX = Math.sin(windDir) * config.windSpeed * MIST_WIND_FACTOR;
    const windZ = -Math.cos(windDir) * config.windSpeed * MIST_WIND_FACTOR;
    const mistOpacity = 0.05 + (config.fogDensity ?? 0) * 0.5;

    group.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      mesh.position.x += windX;
      mesh.position.z += windZ;
      mesh.rotation.y += 0.0002;
      (mesh.material as THREE.MeshBasicMaterial).opacity = mistOpacity;
      if (
        mesh.position.x > MIST_RECYCLE.xMax ||
        mesh.position.x < MIST_RECYCLE.xMin ||
        mesh.position.z > MIST_RECYCLE.zMax ||
        mesh.position.z < MIST_RECYCLE.zMin
      ) {
        mesh.position.set(
          MIST_SPAWN.x + (Math.random() - 0.5) * 4,
          MIST_SPAWN.y + (Math.random() - 0.5) * 2,
          MIST_SPAWN.z + (Math.random() - 0.5) * 4,
        );
      }
    });
  });

  return <group ref={groupRef} />;
}
