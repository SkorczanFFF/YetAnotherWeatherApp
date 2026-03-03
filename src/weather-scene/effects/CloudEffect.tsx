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
import { buildCloud, type CloudSize } from "./clouds/cloudBuilder";
import { getCloudColor } from "./clouds/cloudColor";

const CLOUD_VISIBLE_NEAR = 10;
const CLOUD_VISIBLE_FAR = 120;
const MIN_DRIFT_X = 0.003;
const UPWIND_BIAS = 0.75;
const CLOUD_RECYCLE_MAX_PER_FRAME = 3;
const CLOUD_FADE_IN_DURATION = 3;

const BASE_UPWIND_MARGIN = 5;
const UPWIND_MARGIN_PER_WIND = 0.1;

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------

interface CloudTierConfig {
  name: "light" | "medium" | "overcast";
  count: number;
  yRanges: [number, number][];
  sizeWeights: Record<CloudSize, number>;
  cloudScale: number;
  largeBoxCountOverride?: [number, number];
  opacityRange: [number, number];
}

const LIGHT_TIER: CloudTierConfig = {
  name: "light",
  count: 50,
  yRanges: [[7, 11]],
  sizeWeights: { small: 0.5, medium: 0.35, large: 0.15 },
  cloudScale: 1,
  opacityRange: [0.15, 0.5],
};

const MEDIUM_TIER: CloudTierConfig = {
  name: "medium",
  count: 80,
  yRanges: [[6, 9], [9.5, 12]],
  sizeWeights: { small: 0.2, medium: 0.5, large: 0.3 },
  cloudScale: 1.3,
  opacityRange: [0.35, 0.7],
};

const OVERCAST_TIER: CloudTierConfig = {
  name: "overcast",
  count: 120,
  yRanges: [[5, 7.5], [7.5, 10], [10, 12.5], [12, 14]],
  sizeWeights: { small: 0, medium: 0.3, large: 0.7 },
  cloudScale: 1.8,
  largeBoxCountOverride: [14, 20],
  opacityRange: [0.6, 0.95],
};

export function getTierForCover(cloudCover: number): CloudTierConfig {
  if (cloudCover <= 0.35) return LIGHT_TIER;
  if (cloudCover <= 0.7) return MEDIUM_TIER;
  return OVERCAST_TIER;
}

// ---------------------------------------------------------------------------
// Weighted random size picker
// ---------------------------------------------------------------------------

function pickWeightedSize(weights: Record<CloudSize, number>): CloudSize {
  const r = Math.random();
  const { small, medium } = weights;
  if (r < small) return "small";
  if (r < small + medium) return "medium";
  return "large";
}

// ---------------------------------------------------------------------------
// Spawn helpers
// ---------------------------------------------------------------------------

function randomYFromFloors(yRanges: [number, number][]): number {
  const floor = yRanges[Math.floor(Math.random() * yRanges.length)];
  return floor[0] + Math.random() * (floor[1] - floor[0]);
}

function getGlobalYRange(yRanges: [number, number][]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const [lo, hi] of yRanges) {
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  return [min, max];
}

function randomSpawnPositionFromBounds(
  bounds: FrustumBounds,
  windDirectionDeg: number,
  windSpeed: number,
  yRanges: [number, number][],
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

  let x =
    xCenter +
    upwindX * xRadius * UPWIND_BIAS +
    (Math.random() - 0.5) * 2 * xRadius * 0.9;
  let z =
    zCenter +
    upwindZ * zRadius * UPWIND_BIAS +
    (Math.random() - 0.5) * 2 * zRadius * 0.9;
  x = Math.max(spawnXMin, Math.min(spawnXMax, x));
  z = Math.max(spawnZMin, Math.min(spawnZMax, z));

  const y = randomYFromFloors(yRanges);

  return { x, y, z };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CloudEffectProps {
  config: SimulationConfig;
}

export function CloudEffect({ config }: CloudEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sharedGeomRef = useRef<THREE.BufferGeometry | null>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const boundsRef = useRef<FrustumBounds | null>(null);
  const boundsTimeRef = useRef<number>(0);
  const activeTierRef = useRef<CloudTierConfig["name"] | null>(null);
  const activeCountRef = useRef<number>(0);

  function buildClouds(
    group: THREE.Group,
    sharedGeom: THREE.BufferGeometry,
    tier: CloudTierConfig,
    defaultBounds: FrustumBounds,
    countOverride?: number,
  ): THREE.MeshBasicMaterial[] {
    const materials: THREE.MeshBasicMaterial[] = [];
    const count = countOverride ?? tier.count;
    for (let i = 0; i < count; i++) {
      const size = pickWeightedSize(tier.sizeWeights);
      const boxOverride = size === "large" ? tier.largeBoxCountOverride : undefined;
      const descriptor = buildCloud(size, undefined, tier.cloudScale, boxOverride);
      const cloudGroup = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      materials.push(material);
      for (const box of descriptor.boxes) {
        const mesh = new THREE.Mesh(sharedGeom, material);
        mesh.position.set(box.position[0], box.position[1], box.position[2]);
        mesh.scale.set(box.scale[0], box.scale[1], box.scale[2]);
        cloudGroup.add(mesh);
      }
      const pos = randomSpawnPositionFromBounds(defaultBounds, 0, 0, tier.yRanges);
      cloudGroup.position.set(pos.x, pos.y, pos.z);
      group.add(cloudGroup);
    }
    return materials;
  }

  function disposeClouds(group: THREE.Group) {
    group.children.forEach((child) => {
      (child as THREE.Group).clear();
    });
    group.clear();
    materialsRef.current.forEach((m) => m.dispose());
    materialsRef.current = [];
  }

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const sharedGeom = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
    sharedGeomRef.current = sharedGeom;

    const tier = getTierForCover(config.cloudCover ?? 0.4);
    const [yMin, yMax] = getGlobalYRange(tier.yRanges);
    const defaultCamera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
    defaultCamera.position.set(0, 0, 5);
    defaultCamera.lookAt(0, 0, 0);
    const defaultBounds = computeAxisAlignedCloudBounds(
      defaultCamera,
      CLOUD_VISIBLE_NEAR,
      CLOUD_VISIBLE_FAR,
      yMin,
      yMax,
    );

    const countOverride = config.cloudCount;
    materialsRef.current = buildClouds(group, sharedGeom, tier, defaultBounds, countOverride);
    activeTierRef.current = tier.name;
    activeCountRef.current = countOverride ?? tier.count;

    return () => {
      disposeClouds(group);
      if (sharedGeomRef.current) {
        sharedGeomRef.current.dispose();
        sharedGeomRef.current = null;
      }
      activeTierRef.current = null;
      activeCountRef.current = 0;
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

    const tier = getTierForCover(cover);

    const desiredCount = config.cloudCount ?? tier.count;
    const needsRebuild =
      activeTierRef.current !== tier.name || activeCountRef.current !== desiredCount;

    if (needsRebuild && sharedGeomRef.current) {
      disposeClouds(group);
      const [yMin, yMax] = getGlobalYRange(tier.yRanges);
      const fallbackBounds = computeAxisAlignedCloudBounds(
        state.camera,
        CLOUD_VISIBLE_NEAR,
        CLOUD_VISIBLE_FAR,
        yMin,
        yMax,
      );
      materialsRef.current = buildClouds(
        group,
        sharedGeomRef.current,
        tier,
        fallbackBounds,
        config.cloudCount,
      );
      activeTierRef.current = tier.name;
      activeCountRef.current = desiredCount;
      boundsRef.current = fallbackBounds;
      boundsTimeRef.current = state.clock.getElapsedTime();
    }

    const [yMin, yMax] = getGlobalYRange(tier.yRanges);
    const elapsed = state.clock.getElapsedTime();
    if (!boundsRef.current || elapsed - boundsTimeRef.current >= 1) {
      boundsRef.current = computeAxisAlignedCloudBounds(
        state.camera,
        CLOUD_VISIBLE_NEAR,
        CLOUD_VISIBLE_FAR,
        yMin,
        yMax,
      );
      boundsTimeRef.current = elapsed;
    }
    const bounds = boundsRef.current;
    if (!bounds) return;

    const windDir = (config.windDirection * Math.PI) / 180;
    let cloudWindX = Math.sin(windDir) * config.windSpeed * CLOUD_WIND_FACTOR;
    let cloudWindZ = -Math.cos(windDir) * config.windSpeed * CLOUD_WIND_FACTOR;
    if (
      Math.abs(cloudWindX) < MIN_DRIFT_X &&
      Math.abs(cloudWindZ) < MIN_DRIFT_X
    ) {
      cloudWindX = MIN_DRIFT_X;
    }

    const [opMin, opMax] = tier.opacityRange;
    const coverWithinTier =
      tier.name === "light"
        ? cover / 0.35
        : tier.name === "medium"
          ? (cover - 0.36) / 0.34
          : (cover - 0.71) / 0.29;
    const t = Math.max(0, Math.min(1, coverWithinTier));
    const cloudOpacity =
      (opMin + t * (opMax - opMin)) * (config.thunderstorm ? 1.2 : 1);
    const colorHex = getCloudColor(config);

    let recycledThisFrame = 0;
    group.children.forEach((child) => {
      const cloudGroup = child as THREE.Group;
      const userData = cloudGroup.userData as { spawnTime?: number };
      if (userData.spawnTime === undefined) {
        userData.spawnTime = elapsed;
      }
      const age = elapsed - userData.spawnTime;
      const fade = Math.min(1, age / CLOUD_FADE_IN_DURATION);
      const mesh = cloudGroup.children[0] as THREE.Mesh;
      const mat = mesh?.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = fade * cloudOpacity;
        mat.color.setHex(colorHex);
      }

      cloudGroup.position.x += cloudWindX;
      cloudGroup.position.z += cloudWindZ;
      const outside =
        cloudGroup.position.x < bounds.recycleXMin ||
        cloudGroup.position.x > bounds.recycleXMax ||
        cloudGroup.position.z < bounds.recycleZMin ||
        cloudGroup.position.z > bounds.recycleZMax ||
        cloudGroup.position.y < bounds.spawnYMin;
      if (outside && recycledThisFrame < CLOUD_RECYCLE_MAX_PER_FRAME) {
        recycledThisFrame += 1;
        userData.spawnTime = elapsed;
        const pos = randomSpawnPositionFromBounds(
          bounds,
          config.windDirection,
          config.windSpeed,
          tier.yRanges,
        );
        cloudGroup.position.set(pos.x, pos.y, pos.z);
      }
    });
  });

  return <group ref={groupRef} />;
}
