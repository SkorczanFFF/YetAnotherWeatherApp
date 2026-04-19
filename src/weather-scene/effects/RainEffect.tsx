import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import {
  initParticlePositions,
  computeSpawnParams,
  recycleParticle,
  computeWind,
  cleanupParticles,
} from "./internal/particleUtils";
import { PRECIPITATION_BOUNDS } from "./internal/effectBounds";
import {
  RAIN_WIND_FACTOR,
  DRIZZLE_WIND_FACTOR,
  RAIN_FALL_SPEED_BASE,
  DRIZZLE_FALL_SPEED_BASE,
  THUNDERSTORM_WIND_MULTIPLIER,
  THUNDERSTORM_RAIN_MULTIPLIER,
} from "../physics/weatherPhysics";

const RAIN_COLOR = 0x1e3a5f;
const RAIN_SIZE = 2.5;
const DRIZZLE_SIZE = 1.4;
const RAIN_OPACITY = 0.9;
const DRIZZLE_OPACITY = 0.55;
const MAX_RAIN = 5000;

interface RainEffectProps {
  config: SimulationConfig;
}

export function RainEffect({ config }: RainEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const positions = initParticlePositions(MAX_RAIN, PRECIPITATION_BOUNDS);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometryRef.current = geom;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const material = new THREE.PointsMaterial({
      color: RAIN_COLOR,
      size: RAIN_SIZE * pixelRatio,
      transparent: true,
      opacity: RAIN_OPACITY,
      sizeAttenuation: false,
      depthWrite: false,
      depthTest: true,
    });
    const points = new THREE.Points(geom, material);
    pointsRef.current = points;
    group.add(points);

    return () =>
      cleanupParticles(group, points, geom, material, pointsRef, geometryRef);
  }, []);

  const pixelRatioRef = useRef(Math.min(window.devicePixelRatio, 2));

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    const geometry = geometryRef.current;
    if (!points || !geometry) return;

    const showRain =
      config.effectType === "rain" || config.effectType === "thunderstorm";
    points.visible = showRain;
    if (!showRain) return;

    const isDrizzle = config.isDrizzle && !config.thunderstorm;
    const pixelRatio = pixelRatioRef.current;
    const mat = points.material as THREE.PointsMaterial;
    mat.size = (isDrizzle ? DRIZZLE_SIZE : RAIN_SIZE) * pixelRatio;
    mat.opacity = isDrizzle ? DRIZZLE_OPACITY : RAIN_OPACITY;

    const bounds = PRECIPITATION_BOUNDS;
    geometry.setDrawRange(0, Math.min(MAX_RAIN, config.particleCount));
    const activeCount = Math.min(MAX_RAIN, config.particleCount);

    const stormMult = config.thunderstorm ? THUNDERSTORM_WIND_MULTIPLIER : 1;
    const windFactor = isDrizzle
      ? DRIZZLE_WIND_FACTOR
      : RAIN_WIND_FACTOR * stormMult;
    const { windX, windZ } = computeWind(
      config.windDirection,
      config.windSpeed,
      windFactor,
    );
    const baseFallSpeed = isDrizzle
      ? DRIZZLE_FALL_SPEED_BASE
      : RAIN_FALL_SPEED_BASE *
        (config.thunderstorm ? THUNDERSTORM_RAIN_MULTIPLIER : 1);
    const fallSpeed = baseFallSpeed * delta * 60;

    const pos = geometry.attributes.position.array as Float32Array;
    const spawn = computeSpawnParams(bounds);

    for (let i = 0; i < activeCount; i++) {
      const i3 = i * 3;
      pos[i3] += windX;
      pos[i3 + 1] -= fallSpeed;
      pos[i3 + 2] += windZ;
      recycleParticle(pos, i3, bounds, spawn);
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}
