import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from "three";
import type { SimulationConfig } from "../types";
import { computeParticleBounds } from "./internal/particleBounds";
import { RAIN_VERT, RAIN_FRAG } from "./shaders/rain.glsl";

interface RainEffectProps {
  config: SimulationConfig;
  isMobile?: boolean;
}

// Count caps by intensity. These are WAY lower than the old
// `getParticleCountForIntensity` returned (1600–4500) — rain reads fine
// at 500–1500 when each drop is a streak, and every drop halved on
// mobile keeps the fragment shader budget tight.
const COUNTS_DESKTOP = { light: 500, moderate: 900, heavy: 1500 } as const;
const COUNTS_MOBILE = { light: 250, moderate: 450, heavy: 700 } as const;

// Fall speed (scene units/sec) by intensity.
const FALL_SPEED = { light: 12, moderate: 16, heavy: 22 } as const;

const WIND_FACTOR = 0.03; // km/h → scene u/s for horizontal drift

export function RainEffect({ config, isMobile = false }: RainEffectProps) {
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
        extraHeightTop: 6,
        extraHeightBottom: 2,
      }),
    [fov, size.width, size.height],
  );

  // Geometry + attributes built once per intensity change. Positions and
  // sizes live in plain typed arrays so useFrame can mutate them without
  // going through React state.
  const { geometry, material, positions, sizes, pointsRef } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = randIn(bounds.xMin, bounds.xMax);
      pos[i * 3 + 1] = randIn(bounds.yMin, bounds.yMax);
      pos[i * 3 + 2] = randIn(bounds.zMin, bounds.zMax);
      sz[i] = 1.2 + Math.random() * 1.5;
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(pos, 3));
    geom.setAttribute("aSize", new BufferAttribute(sz, 1));
    const mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color("#aac0d8") },
        uPixelRatio: { value: Math.min(window.devicePixelRatio ?? 1, 2) },
      },
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return {
      geometry: geom,
      material: mat,
      positions: pos,
      sizes: sz,
      pointsRef: { current: null as Points | null },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax]);

  // Wind scalar accumulated via config (changes rarely, memoed per render)
  const windXPerSec = useRef(0);
  const windRad = ((config.windDirection ?? 0) * Math.PI) / 180;
  windXPerSec.current = -Math.sin(windRad) * (config.windSpeed ?? 0) * WIND_FACTOR;

  useFrame((_state, delta) => {
    const p = pointsRef.current;
    if (!p) return;
    const wx = windXPerSec.current * delta;
    const dy = -fallSpeed * delta;
    const pos = positions;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3 + 0] += wx;
      pos[i3 + 1] += dy;
      // Recycle: fell below floor → respawn near top, random X/Z.
      if (pos[i3 + 1] < bounds.yMin) {
        pos[i3 + 0] = randIn(bounds.xMin, bounds.xMax);
        pos[i3 + 1] = bounds.yMax;
        pos[i3 + 2] = randIn(bounds.zMin, bounds.zMax);
      }
      // Wrap horizontally so wind-blown drops keep recycling.
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
