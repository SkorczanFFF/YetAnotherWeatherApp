import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
  TextureLoader,
  RepeatWrapping,
} from "three";
import type { SimulationConfig } from "../types";
import { computeParticleBounds } from "./internal/particleBounds";
import { SNOW_VERT, SNOW_FRAG } from "./shaders/snow.glsl";

interface SnowEffectProps {
  config: SimulationConfig;
  isMobile?: boolean;
}

const COUNTS_DESKTOP = { light: 400, moderate: 700, heavy: 1000 } as const;
const COUNTS_MOBILE = { light: 200, moderate: 350, heavy: 500 } as const;
const FALL_SPEED = { light: 2.5, moderate: 3.5, heavy: 5 } as const;
const WIND_FACTOR = 0.025;

// Module-scope texture cache so all snowflake instances share one atlas.
// We cycle through three PNGs by seeding per-particle UVs; the shader
// does a single texture2D sample.
let snowTexture: ReturnType<TextureLoader["load"]> | null = null;
function getSnowTexture(): NonNullable<typeof snowTexture> {
  if (snowTexture) return snowTexture;
  const loader = new TextureLoader();
  snowTexture = loader.load("/effects/snowflake1.png");
  snowTexture.wrapS = RepeatWrapping;
  snowTexture.wrapT = RepeatWrapping;
  return snowTexture;
}

export function SnowEffect({ config, isMobile = false }: SnowEffectProps) {
  const intensity = config.intensity;
  const count = (isMobile ? COUNTS_MOBILE : COUNTS_DESKTOP)[intensity];
  const fallSpeed = FALL_SPEED[intensity];
  const { camera, size } = useThree();
  const fov = "fov" in camera ? (camera as { fov: number }).fov : 50;

  const bounds = useMemo(
    () =>
      computeParticleBounds({
        fov,
        aspect: size.width / Math.max(1, size.height),
        depthMin: 4,
        depthMax: 18,
        extraHeightTop: 4,
        extraHeightBottom: 2,
      }),
    [fov, size.width, size.height],
  );

  const { geometry, material, positions, pointsRef } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = randIn(bounds.xMin, bounds.xMax);
      pos[i * 3 + 1] = randIn(bounds.yMin, bounds.yMax);
      pos[i * 3 + 2] = randIn(bounds.zMin, bounds.zMax);
      sz[i] = 3 + Math.random() * 4;
      ph[i] = Math.random();
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(pos, 3));
    geom.setAttribute("aSize", new BufferAttribute(sz, 1));
    geom.setAttribute("aPhase", new BufferAttribute(ph, 1));
    const mat = new ShaderMaterial({
      uniforms: {
        uTex: { value: getSnowTexture() },
        uColor: { value: new Color("#f6f9ff") },
        uPixelRatio: { value: Math.min(window.devicePixelRatio ?? 1, 2) },
        uTime: { value: 0 },
      },
      vertexShader: SNOW_VERT,
      fragmentShader: SNOW_FRAG,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    return {
      geometry: geom,
      material: mat,
      positions: pos,
      pointsRef: { current: null as Points | null },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax]);

  const windXPerSec = useRef(0);
  const windRad = ((config.windDirection ?? 0) * Math.PI) / 180;
  windXPerSec.current = -Math.sin(windRad) * (config.windSpeed ?? 0) * WIND_FACTOR;

  useFrame((state, delta) => {
    const p = pointsRef.current;
    if (!p) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const wx = windXPerSec.current * delta;
    const dy = -fallSpeed * delta;
    const pos = positions;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3 + 0] += wx;
      pos[i3 + 1] += dy;
      if (pos[i3 + 1] < bounds.yMin) {
        pos[i3 + 0] = randIn(bounds.xMin, bounds.xMax);
        pos[i3 + 1] = bounds.yMax;
        pos[i3 + 2] = randIn(bounds.zMin, bounds.zMax);
      }
      if (pos[i3 + 0] < bounds.xMin - 1) pos[i3 + 0] = bounds.xMax;
      else if (pos[i3 + 0] > bounds.xMax + 1) pos[i3 + 0] = bounds.xMin;
    }
    (geometry.attributes.position as BufferAttribute).needsUpdate = true;
  });

  return (
    <points
      ref={(el) => {
        pointsRef.current = el as Points | null;
      }}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}

function randIn(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
