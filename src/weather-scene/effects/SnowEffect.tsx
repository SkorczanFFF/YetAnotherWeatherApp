import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig, FrustumBounds } from "../types";
import { getSpawnX, getSpawnZ, computeFrustumBounds } from "../bounds/frustumBounds";
import {
  SNOW_WIND_FACTOR,
  WIND_GUST_VARIANCE,
  SNOW_FALL_SPEED_BASE,
} from "../physics/constants";

const SNOW_COLOR = 0xe8eef4;
const SNOW_SWAY_AMPLITUDE = 1.2;
const SNOW_SWAY_OMEGA = 1.4;
const SNOW_PARTICLE_COUNT_MULTIPLIER = 1.4;
const MAX_SNOW = 4000;

const defaultBounds: FrustumBounds = {
  spawnYMin: 8,
  spawnYMax: 14,
  spawnXMin: -18,
  spawnXMax: 18,
  spawnZMin: -14,
  spawnZMax: 8,
  recycleY: -18,
  recycleXMin: -28,
  recycleXMax: 28,
  recycleZMin: -22,
  recycleZMax: 14,
};

interface SnowEffectProps {
  config: SimulationConfig;
}

export function SnowEffect({ config }: SnowEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const windGustRef = useRef(1);
  const swayTimeRef = useRef(0);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const { center: xCenter, radius: xRadius } = getSpawnX(defaultBounds);
    const { center: zCenter, radius: zRadius } = getSpawnZ(defaultBounds);
    const positions = new Float32Array(MAX_SNOW * 3);
    const phases = new Float32Array(MAX_SNOW);
    for (let i = 0; i < MAX_SNOW; i++) {
      positions[i * 3] = xCenter + (Math.random() - 0.5) * 2 * xRadius;
      positions[i * 3 + 1] =
        defaultBounds.recycleY +
        Math.random() * (defaultBounds.spawnYMax - defaultBounds.recycleY);
      positions[i * 3 + 2] = zCenter + (Math.random() - 0.5) * 2 * zRadius;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    geometryRef.current = geom;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const material = new THREE.PointsMaterial({
      color: SNOW_COLOR,
      size: 4.5 * pixelRatio,
      transparent: true,
      opacity: 1,
      sizeAttenuation: false,
      depthWrite: false,
      depthTest: true,
    });
    const points = new THREE.Points(geom, material);
    pointsRef.current = points;
    group.add(points);

    return () => {
      group.remove(points);
      geom.dispose();
      material.dispose();
      pointsRef.current = null;
      geometryRef.current = null;
    };
  }, []);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    const geometry = geometryRef.current;
    if (!points || !geometry) return;

    const showSnow = config.effectType === "snow";
    points.visible = showSnow;
    if (!showSnow) return;

    swayTimeRef.current += delta;
    const bounds = computeFrustumBounds(state.camera);
    const rawCount = Math.floor(
      config.particleCount * SNOW_PARTICLE_COUNT_MULTIPLIER,
    );
    const activeCount = Math.min(MAX_SNOW, rawCount);
    geometry.setDrawRange(0, activeCount);

    const windDir = (config.windDirection * Math.PI) / 180;
    windGustRef.current =
      1 + (Math.random() - 0.5) * 2 * WIND_GUST_VARIANCE;
    const windX =
      Math.sin(windDir) *
      config.windSpeed *
      SNOW_WIND_FACTOR *
      windGustRef.current;
    const windZ =
      -Math.cos(windDir) *
      config.windSpeed *
      SNOW_WIND_FACTOR *
      windGustRef.current;
    const fallSpeed = SNOW_FALL_SPEED_BASE;

    const pos = geometry.attributes.position.array as Float32Array;
    const phases = (geometry.attributes.phase?.array as Float32Array) ?? null;
    const { center: spawnXCenter, radius: spawnXRadius } = getSpawnX(bounds);
    const { center: spawnZCenter, radius: spawnZRadius } = getSpawnZ(bounds);
    const spawnY = (bounds.spawnYMin + bounds.spawnYMax) / 2;
    const t0 = swayTimeRef.current;

    for (let i = 0; i < activeCount; i++) {
      const i3 = i * 3;
      const phase = phases ? phases[i] : 0;
      const t = t0 + phase;
      const swayDx = SNOW_SWAY_AMPLITUDE * SNOW_SWAY_OMEGA * Math.cos(t) * delta;
      const swayDz =
        -SNOW_SWAY_AMPLITUDE * SNOW_SWAY_OMEGA * Math.sin(t) * delta;
      pos[i3] += windX + swayDx;
      pos[i3 + 1] -= fallSpeed;
      pos[i3 + 2] += windZ + swayDz;
      if (
        pos[i3 + 1] < bounds.recycleY ||
        pos[i3] < bounds.recycleXMin ||
        pos[i3] > bounds.recycleXMax ||
        pos[i3 + 2] < bounds.recycleZMin ||
        pos[i3 + 2] > bounds.recycleZMax
      ) {
        pos[i3] = spawnXCenter + (Math.random() - 0.5) * 2 * spawnXRadius;
        pos[i3 + 1] = spawnY + Math.random() * 2;
        pos[i3 + 2] = spawnZCenter + (Math.random() - 0.5) * 2 * spawnZRadius;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}
