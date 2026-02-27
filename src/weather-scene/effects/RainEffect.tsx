import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, useEffect } from "react";
import * as THREE from "three";
import type { SimulationConfig, FrustumBounds } from "../types";
import { getSpawnX, getSpawnZ, computeFrustumBounds } from "../bounds/frustumBounds";
import {
  RAIN_WIND_FACTOR,
  WIND_GUST_VARIANCE,
  RAIN_FALL_SPEED_BASE,
  THUNDERSTORM_WIND_MULTIPLIER,
  THUNDERSTORM_RAIN_MULTIPLIER,
} from "../physics/constants";

const RAIN_COLOR = 0x1e3a5f;
const MAX_RAIN = 5000;

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

interface RainEffectProps {
  config: SimulationConfig;
}

export function RainEffect({ config }: RainEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const windGustRef = useRef(1);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const { center: xCenter, radius: xRadius } = getSpawnX(defaultBounds);
    const { center: zCenter, radius: zRadius } = getSpawnZ(defaultBounds);
    const positions = new Float32Array(MAX_RAIN * 3);
    for (let i = 0; i < MAX_RAIN; i++) {
      positions[i * 3] = xCenter + (Math.random() - 0.5) * 2 * xRadius;
      positions[i * 3 + 1] =
        defaultBounds.recycleY +
        Math.random() * (defaultBounds.spawnYMax - defaultBounds.recycleY);
      positions[i * 3 + 2] = zCenter + (Math.random() - 0.5) * 2 * zRadius;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometryRef.current = geom;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const material = new THREE.PointsMaterial({
      color: RAIN_COLOR,
      size: 2.5 * pixelRatio,
      transparent: true,
      opacity: 0.9,
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

    const showRain =
      config.effectType === "rain" || config.effectType === "thunderstorm";
    points.visible = showRain;
    if (!showRain) return;

    const bounds = computeFrustumBounds(state.camera);
    geometry.setDrawRange(0, Math.min(MAX_RAIN, config.particleCount));
    const activeCount = Math.min(MAX_RAIN, config.particleCount);

    const windDir = (config.windDirection * Math.PI) / 180;
    windGustRef.current =
      1 + (Math.random() - 0.5) * 2 * WIND_GUST_VARIANCE;
    const stormMult = config.thunderstorm
      ? THUNDERSTORM_WIND_MULTIPLIER
      : 1;
    const rainWind = RAIN_WIND_FACTOR * windGustRef.current * stormMult;
    const windX = Math.sin(windDir) * config.windSpeed * rainWind;
    const windZ = -Math.cos(windDir) * config.windSpeed * rainWind;
    const fallSpeed =
      RAIN_FALL_SPEED_BASE *
      (config.thunderstorm ? THUNDERSTORM_RAIN_MULTIPLIER : 1);

    const pos = geometry.attributes.position.array as Float32Array;
    const { center: spawnXCenter, radius: spawnXRadius } = getSpawnX(bounds);
    const { center: spawnZCenter, radius: spawnZRadius } = getSpawnZ(bounds);
    const spawnY = (bounds.spawnYMin + bounds.spawnYMax) / 2;

    for (let i = 0; i < activeCount; i++) {
      const i3 = i * 3;
      pos[i3] += windX;
      pos[i3 + 1] -= fallSpeed;
      pos[i3 + 2] += windZ;
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
