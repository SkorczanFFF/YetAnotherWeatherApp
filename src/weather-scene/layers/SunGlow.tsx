import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, type Mesh, MathUtils, ShaderMaterial } from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { RENDER_ORDER } from "../core/constants";
import { SUN_GLOW_FRAG, SUN_GLOW_VERT } from "../shaders/sunGlow.glsl";
import { SUN_DISC_DEG } from "./SkyLayer";

const DISTANCE = 1400;
/** Half-size of the glow quad, degrees. */
const HALF_DEG = 28;
const SIZE = 2 * DISTANCE * Math.tan(MathUtils.degToRad(HALF_DEG));
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
        vertexShader: SUN_GLOW_VERT,
        fragmentShader: SUN_GLOW_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const strength =
      MathUtils.smoothstep(s.sunAlt * MathUtils.RAD2DEG, -2, 3) *
      (1 - s.overcast) *
      (1 - MathUtils.smoothstep(s.haze, 0.55, 1));
    mesh.visible = strength > 0.01;
    if (!mesh.visible) return;
    const camera = state.camera;
    mesh.position.copy(camera.position).addScaledVector(s.sunDir, DISTANCE);
    mesh.quaternion.copy(camera.quaternion);
    material.uniforms.uSpread.value = MathUtils.lerp(
      1,
      HIGH_SUN_SPREAD,
      MathUtils.smoothstep(s.sunAlt * MathUtils.RAD2DEG, 8, 35),
    );
    (material.uniforms.uColor.value as Color).copy(s.sunColor).convertLinearToSRGB().multiplyScalar(strength * GAIN);
  });

  return (
    <mesh ref={ref} material={material} renderOrder={RENDER_ORDER.sunGlow} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
