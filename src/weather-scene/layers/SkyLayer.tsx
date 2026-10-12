import { type ComponentRef, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { MathUtils, type ShaderMaterial, type Vector3 } from "three";
import { useSceneSignals } from "../core/sceneSignals";

/**
 * drei <Sky> (three-stdlib Preetham). Driven every frame from SceneSignals:
 * the displayed sun direction places the glow/disc, haze and overcast raise
 * turbidity, twilight warmth bumps rayleigh. Hidden once full night takes
 * over — SkyGrade paints the night gradient on top anyway.
 */
export function SkyLayer() {
  const s = useSceneSignals();
  const ref = useRef<ComponentRef<typeof Sky>>(null);

  useFrame(() => {
    const sky = ref.current;
    if (!sky) return;
    sky.renderOrder = -2;
    sky.visible = s.night < 0.995;
    if (!sky.visible) return;
    const u = (sky.material as ShaderMaterial).uniforms;
    (u.sunPosition.value as Vector3).copy(s.sunDir).multiplyScalar(100);
    u.turbidity.value = 1.6 + 6 * s.haze + 4 * s.overcast;
    u.rayleigh.value = MathUtils.lerp(1.6, 3.0, s.warmth);
    u.mieCoefficient.value = 0.0025 + 0.02 * s.haze;
  });

  return <Sky ref={ref} distance={3000} mieDirectionalG={0.86} />;
}
