/**
 * Wireframe box showing cloud spawn area (width × height × depth).
 * Uses the same bounds as CloudEffect: axis-aligned (depth = world Z, not linked to mouse), wind-expanded X/Z, fixed Y 6–11.
 * Visible only when F7 debug menu is open.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";
import { computeAxisAlignedCloudBounds } from "../../weather-simulation/cameraFrustum";

const CLOUD_VISIBLE_NEAR = 10;
const CLOUD_VISIBLE_FAR = 80;
const CLOUD_SPAWN_Y_MIN = 6;
const CLOUD_SPAWN_Y_MAX = 11;
const BASE_UPWIND_MARGIN = 5;
const UPWIND_MARGIN_PER_WIND = 0.1;

/** Expand spawn X/Z by upwind margin (same as CloudEffect). Y left unchanged. */
function expandSpawnBoundsByWind(
  bounds: {
    spawnXMin: number;
    spawnXMax: number;
    spawnZMin: number;
    spawnZMax: number;
  },
  windDirectionDeg: number,
  windSpeed: number,
) {
  const windRad = (windDirectionDeg * Math.PI) / 180;
  const windX = Math.sin(windRad);
  const windZ = -Math.cos(windRad);
  const upwindX = -windX;
  const upwindZ = -windZ;
  const upwindMargin =
    BASE_UPWIND_MARGIN + windSpeed * UPWIND_MARGIN_PER_WIND;
  return {
    spawnXMin: bounds.spawnXMin + Math.min(0, upwindX) * upwindMargin,
    spawnXMax: bounds.spawnXMax + Math.max(0, upwindX) * upwindMargin,
    spawnZMin: bounds.spawnZMin + Math.min(0, upwindZ) * upwindMargin,
    spawnZMax: bounds.spawnZMax + Math.max(0, upwindZ) * upwindMargin,
  };
}

export interface CloudSpawnBounds {
  width: number;
  height: number;
  depth: number;
}

interface CloudSpawnDebugBoxProps {
  visible: boolean;
  config: SimulationConfig;
  onBoundsChange?: (bounds: CloudSpawnBounds) => void;
}

export function CloudSpawnDebugBox({
  visible,
  config,
  onBoundsChange,
}: CloudSpawnDebugBoxProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastReportedRef = useRef<CloudSpawnBounds | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !visible) return;

    const camera = state.camera;
    const baseBounds = computeAxisAlignedCloudBounds(
      camera,
      CLOUD_VISIBLE_NEAR,
      CLOUD_VISIBLE_FAR,
      CLOUD_SPAWN_Y_MIN,
      CLOUD_SPAWN_Y_MAX,
    );
    const expanded = expandSpawnBoundsByWind(
      baseBounds,
      config.windDirection,
      config.windSpeed,
    );

    const width = expanded.spawnXMax - expanded.spawnXMin;
    const height = CLOUD_SPAWN_Y_MAX - CLOUD_SPAWN_Y_MIN;
    const depth = expanded.spawnZMax - expanded.spawnZMin;

    const center = new THREE.Vector3(
      (expanded.spawnXMin + expanded.spawnXMax) / 2,
      (CLOUD_SPAWN_Y_MIN + CLOUD_SPAWN_Y_MAX) / 2,
      (expanded.spawnZMin + expanded.spawnZMax) / 2,
    );
    const size = new THREE.Vector3(width, height, depth);

    mesh.position.copy(center);
    mesh.scale.copy(size);
    mesh.visible = true;

    const rounded: CloudSpawnBounds = {
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
      depth: Math.round(depth * 10) / 10,
    };
    const last = lastReportedRef.current;
    if (
      onBoundsChange &&
      (!last ||
        last.width !== rounded.width ||
        last.height !== rounded.height ||
        last.depth !== rounded.depth)
    ) {
      lastReportedRef.current = rounded;
      onBoundsChange(rounded);
    }
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color="#00ff88"
        wireframe
        depthTest={true}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}
