import { useFrame, useLoader } from "@react-three/fiber";
import type { RefObject } from "react";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  Lensflare,
  LensflareElement,
} from "three/examples/jsm/objects/Lensflare.js";
import type { SimulationConfig } from "../types";
import { getSunProgress } from "../../weather/config";
import { useSceneRefs } from "../SceneRefsContext";

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
  cameraDistance: 5,
} as const;

const SUN_Y_MIN = 18;
const SUN_Y_MAX = 28;

const SUN = {
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

/** Lens flare attenuation */
const FLARE_LERP_SPEED = 3.0;
const FLARE_HORIZON_FADE = 0.25;
const FLARE_RAYCAST_INTERVAL = 3;
const FLARE_OCCLUSION_RADIUS = 7;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DISC_SAMPLES: [number, number][] = [];
for (let i = 0; i < 8; i++) {
  const theta = i * GOLDEN_ANGLE;
  const r = Math.sqrt(i / 8);
  DISC_SAMPLES.push([r * Math.cos(theta), r * Math.sin(theta)]);
}
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const SUN_COLOR_WARM = new THREE.Color(0xffb347);
const SUN_COLOR_WHITE = new THREE.Color(0xfff5e6);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

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

interface CelestialState {
  sunX: number;
  sunY: number;
  moonX: number;
  showSun: boolean;
  showMoon: boolean;
}

function computeCelestialState(
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
  const showMoon = config.timeOfDay === "night";
  const normalizedArc = 1 - (2 * sunProgress - 1) ** 2;
  const sunY = SUN_Y_MIN + normalizedArc * (SUN_Y_MAX - SUN_Y_MIN);
  return { sunX, sunY, moonX, showSun, showMoon };
}

interface CelestialLightsRefs {
  sunLightRef: RefObject<THREE.PointLight | null>;
  moonLightRef: RefObject<THREE.PointLight | null>;
  lensflareRef: RefObject<InstanceType<typeof Lensflare> | null>;
  flareElementsRef: RefObject<InstanceType<typeof LensflareElement>[]>;
}

function useCelestialLights(groupRef: RefObject<THREE.Group | null>): CelestialLightsRefs {
  const sunLightRef = useRef<THREE.PointLight | null>(null);
  const moonLightRef = useRef<THREE.PointLight | null>(null);
  const lensflareRef = useRef<InstanceType<typeof Lensflare> | null>(null);
  const flareElementsRef = useRef<InstanceType<typeof LensflareElement>[]>([]);
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
    const elements: InstanceType<typeof LensflareElement>[] = [];
    LENS_FLARE_ELEMENTS.forEach((el, i) => {
      const element = new LensflareElement(textures[i], el.pixelSize, el.distance, sunColor);
      lensflare.addElement(element);
      elements.push(element);
    });
    sunLight.add(lensflare);
    lensflareRef.current = lensflare;
    flareElementsRef.current = elements;

    return () => {
      lensflare.dispose();
      sunLight.remove(lensflare);
      flareTexturesRef.current.forEach((t) => t.dispose());
      flareTexturesRef.current = [];
      lensflareRef.current = null;
      flareElementsRef.current = [];
      group.remove(sunLight);
      group.remove(moonLight);
      sunLight.dispose();
      moonLight.dispose();
      sunLightRef.current = null;
      moonLightRef.current = null;
    };
  }, [groupRef]);

  return { sunLightRef, moonLightRef, lensflareRef, flareElementsRef };
}

interface CelestialBodiesProps {
  config: SimulationConfig;
}

export function CelestialBodies({ config }: CelestialBodiesProps) {
  const moonMap = useLoader(THREE.TextureLoader, MOON.textureUrl);
  const groupRef = useRef<THREE.Group>(null);
  const sunGlowRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const { sunLightRef, moonLightRef, lensflareRef, flareElementsRef } =
    useCelestialLights(groupRef);
  const flareBaseSizesRef = useRef<number[]>(
    LENS_FLARE_ELEMENTS.map((el) => el.pixelSize),
  );
  const flareAttenuationRef = useRef(1);
  const sceneRefs = useSceneRefs();
  const raycasterRef = useRef(new THREE.Raycaster());
  const occlusionTargetRef = useRef(0);
  const occlusionRef = useRef(0);
  const rayFrameRef = useRef(0);
  const _sunPos = useRef(new THREE.Vector3());
  const _rayDir = useRef(new THREE.Vector3());
  const _samplePos = useRef(new THREE.Vector3());
  const _sampleDir = useRef(new THREE.Vector3());
  const _right = useRef(new THREE.Vector3());
  const _up = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const group = groupRef.current;
    const sunGlow = sunGlowRef.current;
    const moonMesh = moonMeshRef.current;
    if (!group || !moonMesh) return;

    const camera = state.camera as THREE.PerspectiveCamera;
    const celestial = computeCelestialState(config, camera);

    if (sunGlow)
      sunGlow.position.set(celestial.sunX, celestial.sunY, SUN.z);
    moonMesh.position.set(celestial.moonX, MOON.y, MOON.z);

    const sunLight = sunLightRef.current;
    const moonLight = moonLightRef.current;
    if (sunLight)
      sunLight.position.set(celestial.sunX, celestial.sunY, SUN.z);
    if (moonLight)
      moonLight.position.set(celestial.moonX, MOON.y, MOON.z);

    const hiddenByStorm = config.thunderstorm;
    if (sunGlow) sunGlow.visible = celestial.showSun && !hiddenByStorm;
    moonMesh.visible = celestial.showMoon && !hiddenByStorm;
    if (sunLight) sunLight.visible = celestial.showSun && !hiddenByStorm;
    if (moonLight) moonLight.visible = celestial.showMoon && !hiddenByStorm;

    // Shift sun color toward white during overcast / precipitation
    const cover = config.cloudCover ?? 0;
    const overcastMix = smoothstep(0.3, 0.8, cover);
    if (sunGlow) {
      const mat = sunGlow.material as THREE.MeshBasicMaterial;
      mat.color.copy(SUN_COLOR_WARM).lerp(SUN_COLOR_WHITE, overcastMix);
    }
    if (sunLight) {
      sunLight.color.copy(SUN_COLOR_WARM).lerp(SUN_COLOR_WHITE, overcastMix);
    }

    // Multi-sample raycast from camera to sun disc (Vogel spiral)
    rayFrameRef.current++;
    if (rayFrameRef.current >= FLARE_RAYCAST_INTERVAL) {
      rayFrameRef.current = 0;
      const cloudGroup = sceneRefs?.cloudGroupRef.current;
      const sunWorld = _sunPos.current.set(
        celestial.sunX,
        celestial.sunY,
        SUN.z,
      );
      const cam = camera.position;

      // Build perpendicular frame on the sun disc
      const toSun = _rayDir.current.copy(sunWorld).sub(cam).normalize();
      _right.current.crossVectors(toSun, WORLD_UP).normalize();
      _up.current.crossVectors(_right.current, toSun).normalize();

      const rc = raycasterRef.current;
      let totalOcc = 0;

      if (cloudGroup?.visible) {
        for (let s = 0; s < DISC_SAMPLES.length; s++) {
          const [sx, sy] = DISC_SAMPLES[s];
          const sampleTarget = _samplePos.current
            .copy(sunWorld)
            .addScaledVector(_right.current, sx * FLARE_OCCLUSION_RADIUS)
            .addScaledVector(_up.current, sy * FLARE_OCCLUSION_RADIUS);

          const sampleDir = _sampleDir.current
            .copy(sampleTarget)
            .sub(cam)
            .normalize();

          rc.set(cam, sampleDir);
          rc.far = cam.distanceTo(sampleTarget);

          let sampleOcc = 0;
          const hits = rc.intersectObjects(cloudGroup.children, true);
          for (const hit of hits) {
            const mat = (hit.object as THREE.Mesh)
              .material as THREE.MeshBasicMaterial;
            const o = mat?.opacity ?? 0.5;
            sampleOcc = 1 - (1 - sampleOcc) * (1 - o);
            if (sampleOcc > 0.95) {
              sampleOcc = 1;
              break;
            }
          }
          totalOcc += sampleOcc;
        }
      }
      occlusionTargetRef.current = totalOcc / DISC_SAMPLES.length;
    }

    // Smooth occlusion toward target
    const occDecay = 1 - Math.exp(-FLARE_LERP_SPEED * delta);
    occlusionRef.current +=
      (occlusionTargetRef.current - occlusionRef.current) * occDecay;

    // Lens flare: hidden only for thunderstorm / night.
    // Geometric cloud occlusion dims it when clouds are in the way.
    const lensflare = lensflareRef.current;
    if (lensflare) {
      const occlusionFactor = 1 - occlusionRef.current;

      const elevation =
        (celestial.sunY - SUN_Y_MIN) / (SUN_Y_MAX - SUN_Y_MIN);
      const horizonFactor = smoothstep(0, FLARE_HORIZON_FADE, elevation);

      const stormFactor = hiddenByStorm ? 0 : 1;

      const target = occlusionFactor * horizonFactor * stormFactor;

      const decay = 1 - Math.exp(-FLARE_LERP_SPEED * delta);
      const prev = flareAttenuationRef.current;
      const att = prev + (target - prev) * decay;
      flareAttenuationRef.current = att;

      const baseSizes = flareBaseSizesRef.current;
      const elements = flareElementsRef.current;
      for (let i = 0; i < elements.length; i++) {
        elements[i].size = baseSizes[i] * att;
      }
      lensflare.visible = celestial.showSun && att > 0.01;
    }
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
