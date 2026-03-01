import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {
  SimulationConfig,
  FrustumBounds,
} from "../../weather-simulation/types";
import { CLOUD_WIND_FACTOR } from "../../weather-simulation/physics/weatherPhysics";
import { computeAxisAlignedCloudBounds } from "../../weather-simulation/cameraFrustum";
import { buildCloud, getCloudColor, type CloudSize } from "./clouds";

const NUM_CLOUDS = 70;
const CLOUD_SPAWN_Y_MIN = 6;
const CLOUD_SPAWN_Y_MAX = 11;
/** Visible depth band: spawn only between 10 and 80 units in front of camera. */
const CLOUD_VISIBLE_NEAR = 10;
const CLOUD_VISIBLE_FAR = 70;
const MIN_DRIFT_X = 0.003;
const UPWIND_BIAS = 0.75;
/** Recycle when cloud leaves spawn volume; max per frame to avoid swarms. */
const CLOUD_RECYCLE_MAX_PER_FRAME = 3;

const CLOUD_SIZES: CloudSize[] = ["small", "medium", "large"];

/** Base upwind margin (world units); extended by wind speed so strong wind keeps view filled. */
const BASE_UPWIND_MARGIN = 5;
const UPWIND_MARGIN_PER_WIND = 0.1;

function randomSpawnPositionFromBounds(
  bounds: FrustumBounds,
  windDirectionDeg: number,
  windSpeed: number,
): { x: number; y: number; z: number } {
  const windRad = (windDirectionDeg * Math.PI) / 180;
  const windX = Math.sin(windRad);
  const windZ = -Math.cos(windRad);
  const upwindX = -windX;
  const upwindZ = -windZ;

  const upwindMargin = BASE_UPWIND_MARGIN + windSpeed * UPWIND_MARGIN_PER_WIND;
  const spawnXMin = bounds.spawnXMin + Math.min(0, upwindX) * upwindMargin;
  const spawnXMax = bounds.spawnXMax + Math.max(0, upwindX) * upwindMargin;
  const spawnZMin = bounds.spawnZMin + Math.min(0, upwindZ) * upwindMargin;
  const spawnZMax = bounds.spawnZMax + Math.max(0, upwindZ) * upwindMargin;

  const xCenter = (spawnXMin + spawnXMax) / 2;
  const zCenter = (spawnZMin + spawnZMax) / 2;
  const xRadius = (spawnXMax - spawnXMin) / 2;
  const zRadius = (spawnZMax - spawnZMin) / 2;

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

  return {
    x: Math.max(spawnXMin, Math.min(spawnXMax, x)),
    y,
    z: Math.max(spawnZMin, Math.min(spawnZMax, z)),
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
    const defaultBounds = computeAxisAlignedCloudBounds(
      defaultCamera,
      CLOUD_VISIBLE_NEAR,
      CLOUD_VISIBLE_FAR,
      CLOUD_SPAWN_Y_MIN,
      CLOUD_SPAWN_Y_MAX,
    );

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
      const pos = randomSpawnPositionFromBounds(defaultBounds, 0, 0);
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

    const bounds = computeAxisAlignedCloudBounds(
      state.camera,
      CLOUD_VISIBLE_NEAR,
      CLOUD_VISIBLE_FAR,
      CLOUD_SPAWN_Y_MIN,
      CLOUD_SPAWN_Y_MAX,
    );
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

    let recycledThisFrame = 0;
    group.children.forEach((child) => {
      const cloudGroup = child as THREE.Group;
      cloudGroup.position.x += cloudWindX;
      cloudGroup.position.z += cloudWindZ;
      const outside =
        cloudGroup.position.x < bounds.spawnXMin ||
        cloudGroup.position.x > bounds.spawnXMax ||
        cloudGroup.position.z < bounds.spawnZMin ||
        cloudGroup.position.z > bounds.spawnZMax ||
        cloudGroup.position.y < bounds.spawnYMin;
      if (outside && recycledThisFrame < CLOUD_RECYCLE_MAX_PER_FRAME) {
        recycledThisFrame += 1;
        // Use same spawn volume as initial (no wind expansion) so recycle position matches initial swarm
        const pos = randomSpawnPositionFromBounds(bounds, 0, 0);
        cloudGroup.position.set(pos.x, pos.y, pos.z);
      }
    });
  });

  return <group ref={groupRef} />;
}
