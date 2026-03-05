import { useFrame, useLoader } from "@react-three/fiber";
import type { RefObject } from "react";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  Lensflare,
  LensflareElement,
} from "three/examples/jsm/objects/Lensflare.js";
import type { SimulationConfig } from "../../weather-simulation/types";
import { getSunProgress } from "../../weather/config";

function createRadialGradientTexture(
  size: number,
  colorStops: Array<{ offset: number; color: string }>,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );
  for (const { offset, color } of colorStops) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const CELESTIAL = {
  xRange: 0.55,
  aboveCloudsMin: 0.35,
  aboveCloudsMax: 0.65,
  cameraDistance: 5,
} as const;

const SUN = {
  y: 24,
  z: -50,
  glowSize: 9,
  glowOpacity: 0.45,
  glowColor: 0xffb347,
  lightIntensity: 2,
  lightDistance: 500,
} as const;

const MOON = {
  y: 24,
  z: -43,
  size: 4,
  color: 0xf8f8ff,
  textureUrl: "/effects/moon.jpg",
  lightColor: 0xaaccff,
  lightIntensity: 0.15,
  lightDistance: 400,
} as const;

const LENS_FLARE_ELEMENTS = [
  { size: 128, colorStops: [
    { offset: 0, color: "rgba(255, 255, 220, 0.95)" },
    { offset: 0.15, color: "rgba(255, 245, 180, 0.7)" },
    { offset: 0.35, color: "rgba(255, 200, 100, 0.35)" },
    { offset: 0.6, color: "rgba(255, 160, 60, 0.12)" },
    { offset: 1, color: "rgba(255, 140, 40, 0)" },
  ] as const, pixelSize: 620, distance: 0 },
  { size: 64, colorStops: [
    { offset: 0, color: "rgba(255, 255, 255, 0.9)" },
    { offset: 0.2, color: "rgba(255, 255, 255, 0.4)" },
    { offset: 0.5, color: "rgba(255, 255, 255, 0.1)" },
    { offset: 1, color: "rgba(255, 255, 255, 0)" },
  ] as const, pixelSize: 340, distance: 0.4 },
  { size: 32, colorStops: [
    { offset: 0, color: "rgba(255, 255, 255, 0.9)" },
    { offset: 0.2, color: "rgba(255, 255, 255, 0.4)" },
    { offset: 0.5, color: "rgba(255, 255, 255, 0.1)" },
    { offset: 1, color: "rgba(255, 255, 255, 0)" },
  ] as const, pixelSize: 130, distance: 0.7 },
] as const;

function getXEdge(camera: THREE.PerspectiveCamera): number {
  const depth = Math.abs(SUN.z - CELESTIAL.cameraDistance);
  const fovRad = (camera.fov * Math.PI) / 180;
  return Math.tan(fovRad / 2) * depth * camera.aspect;
}

export interface CelestialState {
  sunX: number;
  moonX: number;
  showSun: boolean;
  showMoon: boolean;
  sunAboveClouds: boolean;
}

export function computeCelestialState(
  config: SimulationConfig,
  camera: THREE.PerspectiveCamera,
): CelestialState {
  const currentDt = config.useRealtimeClock
    ? Date.now() / 1000
    : (config.dt ?? (config.sunrise + config.sunset) / 2);
  const sunProgress = getSunProgress(
    currentDt,
    config.sunrise,
    config.sunset,
  );
  const xEdge = getXEdge(camera);
  const xLimit = xEdge * CELESTIAL.xRange;
  let sunX = -xEdge + sunProgress * 2 * xEdge;
  let moonX = -xEdge + (1 - sunProgress) * 2 * xEdge;
  sunX = Math.max(-xLimit, Math.min(xLimit, sunX));
  moonX = Math.max(-xLimit, Math.min(xLimit, moonX));
  const showSun =
    config.timeOfDay === "day" ||
    config.timeOfDay === "dawn" ||
    config.timeOfDay === "dusk";
  const showMoon =
    config.timeOfDay === "night" ||
    config.timeOfDay === "dawn" ||
    config.timeOfDay === "dusk";
  const sunAboveClouds =
    sunProgress >= CELESTIAL.aboveCloudsMin &&
    sunProgress <= CELESTIAL.aboveCloudsMax;
  return { sunX, moonX, showSun, showMoon, sunAboveClouds };
}

interface CelestialLightsRefs {
  sunLightRef: RefObject<THREE.PointLight | null>;
  moonLightRef: RefObject<THREE.PointLight | null>;
  lensflareRef: RefObject<InstanceType<typeof Lensflare> | null>;
}

function useCelestialLights(groupRef: RefObject<THREE.Group | null>): CelestialLightsRefs {
  const sunLightRef = useRef<THREE.PointLight | null>(null);
  const moonLightRef = useRef<THREE.PointLight | null>(null);
  const lensflareRef = useRef<InstanceType<typeof Lensflare> | null>(null);
  const flareTexturesRef = useRef<THREE.CanvasTexture[]>([]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const sunLight = new THREE.PointLight(
      SUN.glowColor,
      SUN.lightIntensity,
      SUN.lightDistance,
    );
    sunLightRef.current = sunLight;
    group.add(sunLight);

    const moonLight = new THREE.PointLight(
      MOON.lightColor,
      MOON.lightIntensity,
      MOON.lightDistance,
    );
    moonLightRef.current = moonLight;
    group.add(moonLight);

    const textures = LENS_FLARE_ELEMENTS.map((el) =>
      createRadialGradientTexture(el.size, [...el.colorStops]),
    );
    flareTexturesRef.current = textures;

    const sunColor = new THREE.Color(SUN.glowColor);
    const lensflare = new Lensflare();
    LENS_FLARE_ELEMENTS.forEach((el, i) => {
      lensflare.addElement(
        new LensflareElement(textures[i], el.pixelSize, el.distance, sunColor),
      );
    });
    sunLight.add(lensflare);
    lensflareRef.current = lensflare;

    return () => {
      lensflare.dispose();
      sunLight.remove(lensflare);
      flareTexturesRef.current.forEach((t) => t.dispose());
      flareTexturesRef.current = [];
      lensflareRef.current = null;
      group.remove(sunLight);
      group.remove(moonLight);
      sunLight.dispose();
      moonLight.dispose();
      sunLightRef.current = null;
      moonLightRef.current = null;
    };
  }, [groupRef]);

  return { sunLightRef, moonLightRef, lensflareRef };
}

interface CelestialBodiesProps {
  config: SimulationConfig;
}

export function CelestialBodies({ config }: CelestialBodiesProps) {
  const moonMap = useLoader(THREE.TextureLoader, MOON.textureUrl);
  const groupRef = useRef<THREE.Group>(null);
  const sunGlowRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const { sunLightRef, moonLightRef, lensflareRef } =
    useCelestialLights(groupRef);

  useFrame((state) => {
    const group = groupRef.current;
    const sunGlow = sunGlowRef.current;
    const moonMesh = moonMeshRef.current;
    if (!group || !moonMesh) return;

    const camera = state.camera as THREE.PerspectiveCamera;
    const celestial = computeCelestialState(config, camera);

    if (sunGlow)
      sunGlow.position.set(celestial.sunX, SUN.y, SUN.z);
    moonMesh.position.set(celestial.moonX, MOON.y, MOON.z);

    const sunLight = sunLightRef.current;
    const moonLight = moonLightRef.current;
    if (sunLight)
      sunLight.position.set(celestial.sunX, SUN.y, SUN.z);
    if (moonLight)
      moonLight.position.set(celestial.moonX, MOON.y, MOON.z);

    if (sunGlow) sunGlow.visible = celestial.showSun;
    moonMesh.visible = celestial.showMoon;
    if (sunLight) sunLight.visible = celestial.showSun;
    if (moonLight) moonLight.visible = celestial.showMoon;
    const lensflare = lensflareRef.current;
    if (lensflare)
      lensflare.visible = celestial.showSun && !celestial.sunAboveClouds;
  });

  return (
    <group ref={groupRef}>
      <mesh ref={sunGlowRef}>
        <sphereGeometry args={[SUN.glowSize, 32, 32]} />
        <meshBasicMaterial
          color={SUN.glowColor}
          transparent
          opacity={SUN.glowOpacity}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>
      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[MOON.size, 32, 32]} />
        <meshBasicMaterial
          map={moonMap}
          color={MOON.color}
          depthWrite={true}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}
