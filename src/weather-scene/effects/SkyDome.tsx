import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial } from "three";
import type { SimulationConfig } from "../types";
import { PHASE_PALETTES } from "../scene/phasePalette";
import { SKY_DOME_VERT, SKY_DOME_FRAG } from "./shaders/skyDome.glsl";

interface SkyDomeProps {
  config: SimulationConfig;
  /**
   * Optional ref to the material so <ThunderEffect> can drive uFlash
   * without going through React state.
   */
  materialRef?: React.MutableRefObject<ShaderMaterial | null>;
}

const LERP_SPEED = 2.0; // units/sec — phase transitions fade in ~0.5 s

/**
 * Fullscreen clip-space gradient sky. One plane, one draw call, no depth
 * writes — always drawn first (renderOrder = -1) and every other layer
 * composes on top. The colour stops come from PHASE_PALETTES; when the
 * phase changes, the current uniforms lerp toward the new target over
 * ~0.5 s so dusk → night doesn't snap.
 */
export function SkyDome({ config, materialRef }: SkyDomeProps) {
  const material = useMemo(() => {
    const palette = PHASE_PALETTES[config.timeOfDay];
    return new ShaderMaterial({
      uniforms: {
        uHorizon: { value: palette.skyHorizon.clone() },
        uZenith: { value: palette.skyZenith.clone() },
        uFlash: { value: 0 },
      },
      vertexShader: SKY_DOME_VERT,
      fragmentShader: SKY_DOME_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // material is created once; uniforms mutate in useFrame

  // Expose the material for the thunder pulse driver (if wired).
  if (materialRef) {
    materialRef.current = material;
  }

  // Scratch Colors for the lerp — per-frame allocations are avoided by
  // reusing these refs.
  const currentHorizon = useRef(
    PHASE_PALETTES[config.timeOfDay].skyHorizon.clone(),
  );
  const currentZenith = useRef(
    PHASE_PALETTES[config.timeOfDay].skyZenith.clone(),
  );

  useFrame((_state, delta) => {
    const palette = PHASE_PALETTES[config.timeOfDay];
    const k = Math.min(1, delta * LERP_SPEED);
    currentHorizon.current.lerp(palette.skyHorizon, k);
    currentZenith.current.lerp(palette.skyZenith, k);
    (material.uniforms.uHorizon.value as Color).copy(currentHorizon.current);
    (material.uniforms.uZenith.value as Color).copy(currentZenith.current);
  });

  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      {/* Fullscreen clip-space quad. The vertex shader ignores any camera
          matrix, so the geometry dimensions don't matter beyond covering
          the clip volume. */}
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
