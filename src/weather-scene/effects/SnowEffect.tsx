import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../../weather-simulation/types";
import {
  initParticlePositions,
  computeSpawnParams,
  recycleParticle,
  computeWind,
  cleanupParticles,
} from "./particleUtils";
import { PRECIPITATION_BOUNDS } from "./effectBounds";
import {
  SNOW_WIND_FACTOR,
  SNOW_FALL_SPEED_BASE,
} from "../../weather-simulation/physics/weatherPhysics";

const SNOW_COLOR = 0xe8eef4;
const SNOW_SWAY_AMPLITUDE = 1.2;
const SNOW_SWAY_OMEGA = 1.4;
const SNOW_PARTICLE_COUNT_MULTIPLIER = 1.4;
const MAX_SNOW = 4000;

interface SnowEffectProps {
  config: SimulationConfig;
}

export function SnowEffect({ config }: SnowEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const swayTimeRef = useRef(0);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const positions = initParticlePositions(MAX_SNOW, PRECIPITATION_BOUNDS);
    const phases = new Float32Array(MAX_SNOW);
    for (let i = 0; i < MAX_SNOW; i++) {
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

    return () =>
      cleanupParticles(group, points, geom, material, pointsRef, geometryRef);
  }, []);

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    const geometry = geometryRef.current;
    if (!points || !geometry) return;

    const showSnow = config.effectType === "snow";
    points.visible = showSnow;
    if (!showSnow) return;

    swayTimeRef.current += delta;
    const bounds = PRECIPITATION_BOUNDS;
    const rawCount = Math.floor(
      config.particleCount * SNOW_PARTICLE_COUNT_MULTIPLIER,
    );
    const activeCount = Math.min(MAX_SNOW, rawCount);
    geometry.setDrawRange(0, activeCount);

    const { windX, windZ } = computeWind(
      config.windDirection,
      config.windSpeed,
      SNOW_WIND_FACTOR,
    );
    const fallSpeed = SNOW_FALL_SPEED_BASE;

    const pos = geometry.attributes.position.array as Float32Array;
    const phases = (geometry.attributes.phase?.array as Float32Array) ?? null;
    const spawn = computeSpawnParams(bounds);
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
      recycleParticle(pos, i3, bounds, spawn);
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}
