import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import { CLOUD_WIND_FACTOR } from "../physics/constants";

const NUM_CLOUDS = 50;
const RECYCLE_X = 50;
const RECYCLE_Z_FAR = -50;
const RECYCLE_Z_NEAR = 50;
const SPAWN_Z_MIN = -28;
const SPAWN_Z_MAX = -12;
const SPAWN_Y_MIN = 9;
const SPAWN_Y_MAX = 14;
const SPAWN_X_SPREAD = 30;
const MIN_DRIFT_X = 0.003;

function randomCloudScale(): [number, number, number] {
  return [
    1.8 + Math.random() * 3.2,
    0.18 + Math.random() * 0.28,
    1.2 + Math.random() * 2.2,
  ];
}

function randomSpawnPosition(): { x: number; y: number; z: number } {
  return {
    x: (Math.random() - 0.5) * SPAWN_X_SPREAD,
    y: SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN),
    z: SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN),
  };
}

interface CloudEffectProps {
  config: SimulationConfig;
}

export function CloudEffect({ config }: CloudEffectProps) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const baseGeom = new THREE.SphereGeometry(1.2, 10, 8);
    for (let i = 0; i < NUM_CLOUDS; i++) {
      const geom = baseGeom.clone();
      const [sx, sy, sz] = randomCloudScale();
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6 + Math.random() * 0.25,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(geom, mat);
      cloud.scale.set(sx, sy, sz);
      const pos = randomSpawnPosition();
      cloud.position.set(pos.x, pos.y, pos.z);
      cloud.rotation.x = (Math.random() - 0.5) * 0.5;
      cloud.rotation.y = Math.random() * Math.PI * 0.2;
      cloud.rotation.z = (Math.random() - 0.5) * 0.6;
      group.add(cloud);
    }
    baseGeom.dispose();

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

    const cover = config.cloudCover ?? 0;
    if (cover <= 0.02) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const windDir = (config.windDirection * Math.PI) / 180;
    let cloudWindX = Math.sin(windDir) * config.windSpeed * CLOUD_WIND_FACTOR;
    let cloudWindZ =
      -Math.cos(windDir) * config.windSpeed * CLOUD_WIND_FACTOR;
    if (
      Math.abs(cloudWindX) < MIN_DRIFT_X &&
      Math.abs(cloudWindZ) < MIN_DRIFT_X
    ) {
      cloudWindX = MIN_DRIFT_X;
    }
    const cloudOpacity =
      0.12 + cover * 0.78 * (config.thunderstorm ? 1.2 : 1);

    group.children.forEach((child) => {
      const cloud = child as THREE.Mesh;
      cloud.position.x += cloudWindX;
      cloud.position.z += cloudWindZ;
      (cloud.material as THREE.MeshBasicMaterial).opacity = cloudOpacity;
      const pos = randomSpawnPosition();
      if (cloud.position.x > RECYCLE_X) {
        cloud.position.set(-RECYCLE_X + 1 + Math.random() * 3, pos.y, pos.z);
      } else if (cloud.position.x < -RECYCLE_X) {
        cloud.position.set(RECYCLE_X - 1 - Math.random() * 3, pos.y, pos.z);
      } else if (cloud.position.z > RECYCLE_Z_NEAR) {
        cloud.position.set(
          cloud.position.x,
          pos.y,
          RECYCLE_Z_FAR + Math.random() * 3,
        );
      } else if (cloud.position.z < RECYCLE_Z_FAR) {
        cloud.position.set(
          cloud.position.x,
          pos.y,
          RECYCLE_Z_NEAR - Math.random() * 3,
        );
      }
    });
  });

  return <group ref={groupRef} />;
}
