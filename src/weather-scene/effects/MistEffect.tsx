/**
 * Noise-textured mist billboards for ground-level fog wisps.
 * 16 transparent planes with animated Perlin FBM shader, wind-driven,
 * soft-edged via UV fade in the fragment shader.
 */

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";
import { MIST_WIND_FACTOR, windToXZ } from "../physics/weatherPhysics";
import { MIST_BOUNDS } from "./internal/effectBounds";
import { getMistColor } from "./internal/effectColors";
import { getFogNoiseTexture } from "./internal/fogNoise";

const NUM_MIST = 16;
const PLANE_WIDTH = 40;
const PLANE_HEIGHT = 20;

const MIST_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MIST_FRAG = /* glsl */ `
  uniform sampler2D uNoiseTexture;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec2 uWindSpeed;
  uniform vec3 uMistColor;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv * 1.5 + uTime * uWindSpeed;
    float noise = texture2D(uNoiseTexture, uv).r;

    vec2 uv2 = vUv * 3.0 + uTime * uWindSpeed * 1.5 + 0.37;
    float noise2 = texture2D(uNoiseTexture, uv2).r;
    float combined = noise * 0.7 + noise2 * 0.3;

    float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x)
                   * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);

    float alpha = combined * uOpacity * edgeFade;
    gl_FragColor = vec4(uMistColor, alpha);
  }
`;

const mistUniforms = {
  uNoiseTexture: { value: getFogNoiseTexture() },
  uTime: { value: 0 },
  uOpacity: { value: 0.12 },
  uWindSpeed: { value: new THREE.Vector2(0.01, 0.005) },
  uMistColor: { value: new THREE.Color(0xc8dde8) },
};

interface MistEffectProps {
  config: SimulationConfig;
}

export function MistEffect({ config }: MistEffectProps) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const geom = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
    const material = new THREE.ShaderMaterial({
      vertexShader: MIST_VERT,
      fragmentShader: MIST_FRAG,
      uniforms: {
        uNoiseTexture: mistUniforms.uNoiseTexture,
        uTime: mistUniforms.uTime,
        uOpacity: mistUniforms.uOpacity,
        uWindSpeed: mistUniforms.uWindSpeed,
        uMistColor: mistUniforms.uMistColor,
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < NUM_MIST; i++) {
      const mesh = new THREE.Mesh(geom.clone(), material);
      mesh.position.set(
        MIST_BOUNDS.spawn.x + (Math.random() - 0.5) * 30,
        MIST_BOUNDS.spawn.y + Math.random() * 4 - 1,
        MIST_BOUNDS.spawn.z + (Math.random() - 0.5) * 20,
      );
      mesh.rotation.x = Math.random() * 0.4 - 0.1;
      mesh.rotation.z = Math.random() * 0.3 - 0.15;
      group.add(mesh);
    }

    geom.dispose();

    return () => {
      group.children.forEach((child) => {
        (child as THREE.Mesh).geometry.dispose();
      });
      material.dispose();
      group.clear();
    };
  }, []);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const showMist = (config.fogDensity ?? 0) > 0.02;
    group.visible = showMist;
    if (!showMist) return;

    mistUniforms.uTime.value += delta;
    mistUniforms.uOpacity.value = 0.06 + (config.fogDensity ?? 0) * 0.6;

    const { x: windX, z: windZ } = windToXZ(
      config.windDirection,
      config.windSpeed,
      MIST_WIND_FACTOR,
    );
    mistUniforms.uWindSpeed.value.set(windX * 8 + 0.003, windZ * 8 + 0.001);

    mistUniforms.uMistColor.value.copy(
      getMistColor(config.timeOfDay, config.thunderstorm),
    );

    group.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      mesh.position.x += windX;
      mesh.position.z += windZ;
      mesh.rotation.y += 0.0001;

      if (
        mesh.position.x > MIST_BOUNDS.recycle.xMax + 10 ||
        mesh.position.x < MIST_BOUNDS.recycle.xMin - 10 ||
        mesh.position.z > MIST_BOUNDS.recycle.zMax + 10 ||
        mesh.position.z < MIST_BOUNDS.recycle.zMin - 10
      ) {
        mesh.position.set(
          MIST_BOUNDS.spawn.x + (Math.random() - 0.5) * 30,
          MIST_BOUNDS.spawn.y + Math.random() * 4 - 1,
          MIST_BOUNDS.spawn.z + (Math.random() - 0.5) * 20,
        );
      }
    });
  });

  return <group ref={groupRef} />;
}
