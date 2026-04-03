import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useSceneRefsRequired } from "../SceneRefsContext";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {
  SimulationConfig,
  FrustumBounds,
} from "../types";
import { CLOUD_WIND_FACTOR, windToXZ } from "../physics/weatherPhysics";
import { computeAxisAlignedCloudBounds } from "../cameraFrustum";
import { buildCloud } from "./clouds/cloudBuilder";
import { getCloudColor, shiftGray } from "./clouds/cloudColor";
import { randomSpawnPositionFromBounds } from "./clouds/cloudSpawning";
import {
  getTierForCover,
  pickWeightedSize,
  getGlobalYRange,
  type CloudTierConfig,
} from "./clouds/cloudTiers";
import {
  CLOUD_VISIBLE_NEAR,
  CLOUD_VISIBLE_FAR,
  MIN_DRIFT_X,
  CLOUD_RECYCLE_MAX_PER_FRAME,
  CLOUD_FADE_IN_DURATION,
} from "./clouds/cloudConstants";


interface CloudEffectProps {
  config: SimulationConfig;
}

export function CloudEffect({ config }: CloudEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const sceneRefs = useSceneRefsRequired();
  const setGroupRef = useCallback(
    (el: THREE.Group | null) => {
      (groupRef as React.MutableRefObject<THREE.Group | null>).current = el;
      sceneRefs.cloudGroupRef.current = el;
    },
    [sceneRefs],
  );
  const sharedGeomRef = useRef<THREE.BufferGeometry | null>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const cloudPositionsRef = useRef<Float32Array | null>(null);
  const boundsRef = useRef<FrustumBounds | null>(null);
  const boundsTimeRef = useRef<number>(0);

  function buildClouds(
    group: THREE.Group,
    sharedGeom: THREE.BufferGeometry,
    tier: CloudTierConfig,
    defaultBounds: FrustumBounds,
    countOverride?: number,
  ): THREE.MeshBasicMaterial[] {
    const materials: THREE.MeshBasicMaterial[] = [];
    const count = countOverride ?? tier.count;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const size = pickWeightedSize(tier.sizeWeights);
      const boxOverride = (size === "large" || size === "extreme") ? tier.largeBoxCountOverride : undefined;
      const descriptor = buildCloud(size, undefined, tier.cloudScale, boxOverride);
      const cloudGroup = new THREE.Group();
      for (const box of descriptor.boxes) {
        const brightnessOffset = size === "blanket"
          ? Math.round((Math.random() - 0.5) * 10)
          : Math.round((Math.random() - 0.5) * 30);
        const material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        material.userData.brightnessOffset = brightnessOffset;
        materials.push(material);
        const mesh = new THREE.Mesh(sharedGeom, material);
        mesh.position.set(box.position[0], box.position[1], box.position[2]);
        mesh.scale.set(box.scale[0], box.scale[1], box.scale[2]);
        cloudGroup.add(mesh);
      }
      const pos = randomSpawnPositionFromBounds(defaultBounds, 0, 0, tier.yRanges);
      const i3 = i * 3;
      positions[i3] = pos.x;
      positions[i3 + 1] = pos.y;
      positions[i3 + 2] = pos.z;
      cloudGroup.position.set(pos.x, pos.y, pos.z);
      group.add(cloudGroup);
    }
    cloudPositionsRef.current = positions;
    return materials;
  }

  function disposeClouds(group: THREE.Group) {
    group.children.forEach((child) => {
      (child as THREE.Group).clear();
    });
    group.clear();
    materialsRef.current.forEach((m) => m.dispose());
    materialsRef.current = [];
    cloudPositionsRef.current = null;
  }

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const sharedGeom = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
    sharedGeomRef.current = sharedGeom;

    const tier = getTierForCover(config.cloudCover ?? 0.4);
    const [yMin, yMax] = getGlobalYRange(tier.yRanges);
    const defaultBounds = computeAxisAlignedCloudBounds(
      camera,
      CLOUD_VISIBLE_NEAR,
      CLOUD_VISIBLE_FAR,
      yMin,
      yMax,
    );

    const countOverride = config.cloudCount;
    materialsRef.current = buildClouds(group, sharedGeom, tier, defaultBounds, countOverride);

    return () => {
      disposeClouds(group);
      if (sharedGeomRef.current) {
        sharedGeomRef.current.dispose();
        sharedGeomRef.current = null;
      }
    };
  }, [config.cloudCount, config.cloudCover]);

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

    let { x: cloudWindX, z: cloudWindZ } = windToXZ(config.windDirection, config.windSpeed, CLOUD_WIND_FACTOR);
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
          : tier.name === "overcast"
            ? (cover - 0.71) / 0.14
            : tier.name === "extreme"
              ? (cover - 0.86) / 0.09
              : (cover - 0.96) / 0.04;
    const t = Math.max(0, Math.min(1, coverWithinTier));
    const autoOpacity =
      (opMin + t * (opMax - opMin)) * (config.thunderstorm ? 1.2 : 1);
    const cloudOpacity = config.cloudOpacity ?? autoOpacity;
    const colorHex = getCloudColor(config);

    const positions = cloudPositionsRef.current;
    if (!positions) return;
    const count = group.children.length;

    // Fast pass: apply wind drift to flat array
    for (let i = 0; i < count; i++) {
      positions[i * 3] += cloudWindX;
      positions[i * 3 + 2] += cloudWindZ;
    }

    // Bounds check on flat array, then sync to THREE.Group + update materials
    let recycled = 0;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const cloudGroup = group.children[i] as THREE.Group;
      const userData = cloudGroup.userData as { spawnTime?: number };
      if (userData.spawnTime === undefined) userData.spawnTime = elapsed;

      // Recycle check (from flat array — no Object3D property reads)
      if (recycled < CLOUD_RECYCLE_MAX_PER_FRAME) {
        const outside =
          positions[i3] < bounds.recycleXMin ||
          positions[i3] > bounds.recycleXMax ||
          positions[i3 + 2] < bounds.recycleZMin ||
          positions[i3 + 2] > bounds.recycleZMax ||
          positions[i3 + 1] < bounds.spawnYMin;
        if (outside) {
          recycled++;
          userData.spawnTime = elapsed;
          const pos = randomSpawnPositionFromBounds(
            bounds,
            config.windDirection,
            config.windSpeed,
            tier.yRanges,
          );
          positions[i3] = pos.x;
          positions[i3 + 1] = pos.y;
          positions[i3 + 2] = pos.z;
        }
      }

      // Sync position from flat array to THREE.Group
      cloudGroup.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);

      // Update materials
      const age = elapsed - userData.spawnTime;
      const fade = Math.min(1, age / CLOUD_FADE_IN_DURATION);
      for (const child of cloudGroup.children) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (!mat) continue;
        mat.opacity = fade * cloudOpacity;
        const offset = (mat.userData.brightnessOffset as number) ?? 0;
        mat.color.setHex(shiftGray(colorHex, offset));
      }
    }
  });

  return <group ref={setGroupRef} />;
}
