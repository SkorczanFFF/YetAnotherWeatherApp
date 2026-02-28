import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {
  SimulationConfig,
  FrustumBounds,
} from "../../weather-simulation/types";
import { CLOUD_WIND_FACTOR } from "../../weather-simulation/physics/weatherPhysics";
import {
  computeFrustumBounds,
  getSpawnX,
  getSpawnZ,
} from "../../weather-simulation/cameraFrustum";
import { buildCloud, getCloudColor, type CloudSize } from "./clouds";

const NUM_CLOUDS = 50;
const CLOUD_SPAWN_Y_MIN = 6;
const CLOUD_SPAWN_Y_MAX = 11;
const CLOUD_SPAWN_Z_MAX = -50;
const MIN_DRIFT_X = 0.003;
const UPWIND_BIAS = 0.75;

const CLOUD_SIZES: CloudSize[] = ["small", "medium", "large"];

function randomSpawnPositionFromBounds(
  bounds: FrustumBounds,
  windDirectionDeg: number,
): { x: number; y: number; z: number } {
  const { center: xCenter, radius: xRadius } = getSpawnX(bounds);
  const { center: zCenter, radius: zRadius } = getSpawnZ(bounds);
  const windRad = (windDirectionDeg * Math.PI) / 180;
  const windX = Math.sin(windRad);
  const windZ = -Math.cos(windRad);
  const upwindX = -windX;
  const upwindZ = -windZ;
  const jitter = 0.4;
  const x =
    xCenter +
    upwindX * xRadius * UPWIND_BIAS +
    (Math.random() - 0.5) * 2 * xRadius * jitter;
  const z =
    zCenter +
    upwindZ * zRadius * UPWIND_BIAS +
    (Math.random() - 0.5) * 2 * zRadius * jitter;
  const y =
    CLOUD_SPAWN_Y_MIN + Math.random() * (CLOUD_SPAWN_Y_MAX - CLOUD_SPAWN_Y_MIN);
  const zClamped = Math.max(
    bounds.spawnZMin,
    Math.min(CLOUD_SPAWN_Z_MAX, bounds.spawnZMax, z),
  );
  return {
    x: Math.max(bounds.spawnXMin, Math.min(bounds.spawnXMax, x)),
    y,
    z: zClamped,
  };
}

interface CloudEffectProps {
  config: SimulationConfig;
}

export function CloudEffect({ config }: CloudEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sharedGeomRef = useRef<THREE.BufferGeometry | null>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const sharedGeom = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
    sharedGeomRef.current = sharedGeom;

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    const defaultCamera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
    defaultCamera.position.set(0, 0, 5);
    defaultCamera.lookAt(0, 0, 0);
    const defaultBounds = computeFrustumBounds(defaultCamera);

    for (let i = 0; i < NUM_CLOUDS; i++) {
      const size = CLOUD_SIZES[Math.floor(Math.random() * CLOUD_SIZES.length)];
      const descriptor = buildCloud(size);
      const cloudGroup = new THREE.Group();
      for (const box of descriptor.boxes) {
        const mesh = new THREE.Mesh(sharedGeom, material);
        mesh.position.set(box.position[0], box.position[1], box.position[2]);
        mesh.scale.set(box.scale[0], box.scale[1], box.scale[2]);
        cloudGroup.add(mesh);
      }
      const pos = randomSpawnPositionFromBounds(defaultBounds, 0);
      cloudGroup.position.set(pos.x, pos.y, pos.z);
      group.add(cloudGroup);
    }

    return () => {
      group.children.forEach((child) => {
        const cloudGroup = child as THREE.Group;
        cloudGroup.clear();
      });
      group.clear();
      if (sharedGeomRef.current) {
        sharedGeomRef.current.dispose();
        sharedGeomRef.current = null;
      }
      material.dispose();
    };
  }, []);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const cover = config.cloudCover ?? 0;
    if (cover <= 0.02) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const bounds = computeFrustumBounds(state.camera);
    const windDir = (config.windDirection * Math.PI) / 180;
    let cloudWindX = Math.sin(windDir) * config.windSpeed * CLOUD_WIND_FACTOR;
    let cloudWindZ = -Math.cos(windDir) * config.windSpeed * CLOUD_WIND_FACTOR;
    if (
      Math.abs(cloudWindX) < MIN_DRIFT_X &&
      Math.abs(cloudWindZ) < MIN_DRIFT_X
    ) {
      cloudWindX = MIN_DRIFT_X;
    }
    const cloudOpacity = 0.12 + cover * 0.78 * (config.thunderstorm ? 1.2 : 1);
    const firstChild = group.children[0] as THREE.Group | undefined;
    const sharedMat = firstChild?.children[0]
      ? ((firstChild.children[0] as THREE.Mesh)
          .material as THREE.MeshBasicMaterial)
      : null;
    if (sharedMat) {
      sharedMat.opacity = cloudOpacity;
      sharedMat.color.setHex(getCloudColor(config));
    }

    group.children.forEach((child) => {
      const cloudGroup = child as THREE.Group;
      cloudGroup.position.x += cloudWindX;
      cloudGroup.position.z += cloudWindZ;
      const outside =
        cloudGroup.position.x < bounds.recycleXMin ||
        cloudGroup.position.x > bounds.recycleXMax ||
        cloudGroup.position.z < bounds.recycleZMin ||
        cloudGroup.position.z > bounds.recycleZMax ||
        cloudGroup.position.y < bounds.recycleY;
      if (outside) {
        const pos = randomSpawnPositionFromBounds(bounds, config.windDirection);
        cloudGroup.position.set(pos.x, pos.y, pos.z);
      }
    });
  });

  return <group ref={groupRef} />;
}
