import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, ShaderMaterial, Vector2 } from "three";
import type { SimulationConfig } from "../types";
import { PHASE_PALETTES } from "../scene/phasePalette";
import { getCloudNoiseTexture } from "./internal/noiseTexture";
import { CLOUD_VERT, CLOUD_FRAG } from "./shaders/cloudLayer.glsl";

interface CloudLayerProps {
  config: SimulationConfig;
}

// km/h → scene UV units/sec. Tuned so a 20 km/h wind drifts the noise
// pattern by about half a UV period over 90 seconds — clouds visibly move
// without racing.
const WIND_UV_SCALE = 0.00016;
const MIN_DRIFT = 0.00008;

// Cloud cover hysteresis — switch to stratus mode at 0.72, back to
// cumulus at 0.68. Prevents flicker near the threshold when cloudCover
// hovers around 0.7.
const MODE_UP = 0.72;
const MODE_DOWN = 0.68;

/**
 * Single plane + custom shader cloud renderer. One draw call. No drei
 * Cloud, no sprites, no InstancedMesh — the plane is a fullscreen
 * clip-space quad and the shader computes cloud alpha from a pre-baked
 * tileable FBM texture.
 *
 * Modes:
 *  - cumulus — discrete puffs, cloudCover controls threshold
 *  - stratus — flat blanket, cloudCover controls fill amount
 *
 * The component returns null when cloudCover ≤ 0.05 so a clear sky costs
 * zero draw calls.
 */
export function CloudLayer({ config }: CloudLayerProps) {
  const cover = config.cloudCover ?? 0;
  const modeRef = useRef<0 | 1>(cover >= MODE_UP ? 1 : 0);
  const windUvRef = useRef(new Vector2(0, 0));
  const currentTintRef = useRef(
    PHASE_PALETTES[config.timeOfDay].cloudTint.clone(),
  );
  const { size } = useThree();

  const material = useMemo(() => {
    const texture = getCloudNoiseTexture();
    return new ShaderMaterial({
      uniforms: {
        uNoise: { value: texture },
        uCover: { value: cover },
        uTint: {
          value: PHASE_PALETTES[config.timeOfDay].cloudTint.clone(),
        },
        uWindUV: { value: new Vector2(0, 0) },
        uMode: { value: modeRef.current },
        uAspect: { value: 1 },
        uAltitude: { value: 0.5 },
      },
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // material built once; uniforms mutated in useFrame

  useFrame((_state, delta) => {
    const c = config.cloudCover ?? 0;
    // Hysteresis — don't flip modes inside the transition band.
    if (modeRef.current === 0 && c >= MODE_UP) modeRef.current = 1;
    else if (modeRef.current === 1 && c < MODE_DOWN) modeRef.current = 0;

    // Wind vector. `windDirection` is the compass direction the wind is
    // FROM (north = 0°). Cloud UVs drift OPPOSITE that, so invert.
    const rad = ((config.windDirection ?? 0) * Math.PI) / 180;
    const windSpeed = config.windSpeed ?? 0;
    let dx = -Math.sin(rad) * windSpeed * WIND_UV_SCALE;
    let dy = Math.cos(rad) * windSpeed * WIND_UV_SCALE;
    if (Math.abs(dx) < MIN_DRIFT && Math.abs(dy) < MIN_DRIFT) {
      dx = MIN_DRIFT;
      dy = MIN_DRIFT * 0.3;
    }
    windUvRef.current.x += dx * delta;
    windUvRef.current.y += dy * delta;

    // Lerp tint toward phase target — keeps dusk/dawn transitions smooth.
    const targetTint = PHASE_PALETTES[config.timeOfDay].cloudTint;
    const k = Math.min(1, delta * 2.0);
    currentTintRef.current.lerp(targetTint, k);

    material.uniforms.uCover.value = c;
    material.uniforms.uMode.value = modeRef.current;
    (material.uniforms.uWindUV.value as Vector2).copy(windUvRef.current);
    (material.uniforms.uTint.value as Color).copy(currentTintRef.current);
    material.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  });

  if (cover <= 0.05) return null;

  return (
    <mesh material={material} renderOrder={1} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
