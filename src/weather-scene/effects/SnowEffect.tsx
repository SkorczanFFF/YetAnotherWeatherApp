import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import {
  initParticlePositions,
  computeSpawnParams,
  recycleParticle,
  computeWind,
} from "./particleUtils";
import { PRECIPITATION_BOUNDS } from "./effectBounds";
import {
  SNOW_WIND_FACTOR,
  SNOW_FALL_SPEED_BASE,
} from "../physics/weatherPhysics";

const SNOW_COLOR = 0xe8eef4;
const SNOW_SWAY_AMPLITUDE = 1.2;
const SNOW_SWAY_OMEGA = 1.4;
const SNOW_PARTICLE_COUNT_MULTIPLIER = 1.4;
const MAX_SNOW = 4000;

const SNOWFLAKE_TEXTURES = [
  "/effects/snowflake1.png",
  "/effects/snowflake2.png",
  "/effects/snowflake3.png",
];

const LAYER_COUNT = SNOWFLAKE_TEXTURES.length;
const PARTICLES_PER_LAYER = Math.ceil(MAX_SNOW / LAYER_COUNT);

/** Base size per layer – slight variation adds visual depth */
const LAYER_SIZES = [8, 10, 6];

interface SnowLayer {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
}

interface SnowEffectProps {
  config: SimulationConfig;
}

const loader = new THREE.TextureLoader();

export function SnowEffect({ config }: SnowEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const layersRef = useRef<SnowLayer[]>([]);
  const swayTimeRef = useRef(0);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const layers: SnowLayer[] = [];

    for (let l = 0; l < LAYER_COUNT; l++) {
      const positions = initParticlePositions(
        PARTICLES_PER_LAYER,
        PRECIPITATION_BOUNDS,
      );
      const phases = new Float32Array(PARTICLES_PER_LAYER);
      for (let i = 0; i < PARTICLES_PER_LAYER; i++) {
        phases[i] = Math.random() * Math.PI * 2;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.setAttribute("phase", new THREE.BufferAttribute(phases, 1));

      const texture = loader.load(SNOWFLAKE_TEXTURES[l]);
      texture.colorSpace = THREE.SRGBColorSpace;

      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      const material = new THREE.PointsMaterial({
        color: SNOW_COLOR,
        size: LAYER_SIZES[l] * pixelRatio,
        map: texture,
        transparent: true,
        opacity: 0.85,
        alphaTest: 0.05,
        sizeAttenuation: false,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
      });

      const points = new THREE.Points(geom, material);
      group.add(points);
      layers.push({ points, geometry: geom, material });
    }

    layersRef.current = layers;

    return () => {
      for (const layer of layers) {
        group.remove(layer.points);
        layer.geometry.dispose();
        layer.material.map?.dispose();
        layer.material.dispose();
      }
      layersRef.current = [];
    };
  }, []);

  useFrame((_state, delta) => {
    const layers = layersRef.current;
    if (layers.length === 0) return;

    const showSnow = config.effectType === "snow";
    for (const layer of layers) {
      layer.points.visible = showSnow;
    }
    if (!showSnow) return;

    swayTimeRef.current += delta;
    const bounds = PRECIPITATION_BOUNDS;
    const rawCount = Math.floor(
      config.particleCount * SNOW_PARTICLE_COUNT_MULTIPLIER,
    );
    const totalActive = Math.min(MAX_SNOW, rawCount);
    const perLayer = Math.ceil(totalActive / LAYER_COUNT);

    const { windX, windZ } = computeWind(
      config.windDirection,
      config.windSpeed,
      SNOW_WIND_FACTOR,
    );
    const fallSpeed = SNOW_FALL_SPEED_BASE;
    const spawn = computeSpawnParams(bounds);
    const t0 = swayTimeRef.current;

    for (const layer of layers) {
      const geom = layer.geometry;
      const activeCount = Math.min(PARTICLES_PER_LAYER, perLayer);
      geom.setDrawRange(0, activeCount);

      const pos = geom.attributes.position.array as Float32Array;
      const phases =
        (geom.attributes.phase?.array as Float32Array) ?? null;

      for (let i = 0; i < activeCount; i++) {
        const i3 = i * 3;
        const phase = phases ? phases[i] : 0;
        const t = t0 + phase;
        const swayDx =
          SNOW_SWAY_AMPLITUDE * SNOW_SWAY_OMEGA * Math.cos(t) * delta;
        const swayDz =
          -SNOW_SWAY_AMPLITUDE * SNOW_SWAY_OMEGA * Math.sin(t) * delta;
        pos[i3] += windX + swayDx;
        pos[i3 + 1] -= fallSpeed;
        pos[i3 + 2] += windZ + swayDz;
        recycleParticle(pos, i3, bounds, spawn);
      }
      geom.attributes.position.needsUpdate = true;
    }
  });

  return <group ref={groupRef} />;
}
