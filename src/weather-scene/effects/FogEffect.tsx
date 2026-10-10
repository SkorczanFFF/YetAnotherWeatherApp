import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial } from "three";
import type { SimulationConfig } from "../types";
import { PHASE_PALETTES } from "../scene/phasePalette";

interface FogEffectProps {
  config: SimulationConfig;
}

// Fullscreen fog overlay. Because the scene has no opaque world geometry
// (just clip-space gradients + particle points), `THREE.FogExp2` has
// nothing to tint — it only affects materials that opt-in with
// `material.fog = true`. A simpler path: a fullscreen plane with a
// phase-tinted colour and alpha driven by `config.fogDensity`.

const FOG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.995, 1.0);
}
`;

const FOG_FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uDensity;
varying vec2 vUv;

void main() {
  // Fog is denser near horizon (vUv.y small) and thins out toward the
  // zenith — matches how real ground fog layers view.
  float gradient = 1.0 - smoothstep(0.1, 0.85, vUv.y);
  float alpha = clamp(uDensity * (0.25 + gradient * 0.9), 0.0, 0.96);
  gl_FragColor = vec4(uColor, alpha);
}
`;

export function FogEffect({ config }: FogEffectProps) {
  const currentColor = useRef(
    PHASE_PALETTES[config.timeOfDay].cloudTint.clone(),
  );

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: {
            value: PHASE_PALETTES[config.timeOfDay].cloudTint.clone(),
          },
          // fogDensity is [0, 0.1] from the weather mapping; scale so 0.1
          // reads as near-total obscuration.
          uDensity: { value: Math.min(1, (config.fogDensity ?? 0) * 9) },
        },
        vertexShader: FOG_VERT,
        fragmentShader: FOG_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_state, delta) => {
    const target = PHASE_PALETTES[config.timeOfDay].cloudTint;
    currentColor.current.lerp(target, Math.min(1, delta * 2));
    (material.uniforms.uColor.value as Color).copy(currentColor.current);
    material.uniforms.uDensity.value = Math.min(
      1,
      (config.fogDensity ?? 0) * 9,
    );
  });

  // Skip entirely when there's effectively no fog.
  if ((config.fogDensity ?? 0) <= 0.005) return null;

  return (
    <mesh material={material} renderOrder={5} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
