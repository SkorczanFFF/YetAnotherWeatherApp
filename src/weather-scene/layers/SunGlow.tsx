import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Mesh, MathUtils, ShaderMaterial } from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { CELESTIAL_DISTANCE, DISPLAY_OVERLAY, RENDER_ORDER, SUN_DISC_DEG } from "../core/constants";
import { SUN_GLOW_FRAG } from "../shaders/sunGlow.glsl";
import { BILLBOARD_VERT } from "../shaders/chunks.glsl";
import { placeBillboard } from "../core/celestial";

/** Half-size of the glow quad, degrees. */
const HALF_DEG = 28;
const SIZE = 2 * CELESTIAL_DISTANCE * Math.tan(MathUtils.degToRad(HALF_DEG));
/** Display brightness of the glow at full strength (tuned by eye). */
const GAIN = 1.0;
/** Rim + halo gain with a sun high up: its sky is already near white, and more blew the disc out. */
const HIGH_SUN_SPREAD = 0.3;

/** Rim and halo of light around the displayed sun; overcast and fog put it out. */
export function SunGlow() {
  const s = useSceneSignals();
  const ref = useRef<Mesh>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color() },
          uHalfDeg: { value: HALF_DEG },
          uDiscDeg: { value: SUN_DISC_DEG },
          uSpread: { value: 1 },
        },
        vertexShader: BILLBOARD_VERT,
        fragmentShader: SUN_GLOW_FRAG,
        ...DISPLAY_OVERLAY,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const strength =
      s.sunDisc *
      (1 - s.overcast) *
      (1 - MathUtils.smoothstep(s.haze, 0.55, 1));
    mesh.visible = strength > 0.01;
    if (!mesh.visible) return;
    placeBillboard(mesh, state.camera, s.sunDir);
    material.uniforms.uSpread.value = MathUtils.lerp(
      1,
      HIGH_SUN_SPREAD,
      MathUtils.smoothstep(s.sunAltDeg, 8, 35),
    );
    (material.uniforms.uColor.value as Color).copy(s.sunColorDisplay).multiplyScalar(strength * GAIN);
  });

  return (
    <mesh ref={ref} material={material} renderOrder={RENDER_ORDER.sunGlow} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
