import { type ComponentRef, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { MathUtils, type ShaderMaterial, type Vector3 } from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { RENDER_ORDER, SUN_DISC_DEG } from "../core/constants";

const SUN_RADIUS = SUN_DISC_DEG * MathUtils.DEG2RAD;
const SUN_COS = Math.cos(SUN_RADIUS);
/** Soft rim, the same share of the radius as Preetham's (+0.00002 on 1 − 0.9999567). */
const SUN_EDGE = (1 - SUN_COS) * 0.46;

/**
 * drei <Sky> (Preetham) at the displayed sun; haze/overcast raise turbidity, warmth rayleigh.
 * Hidden at full night, where SkyGrade's night gradient covers it anyway.
 */
export function SkyLayer() {
  const s = useSceneSignals();
  const ref = useRef<ComponentRef<typeof Sky>>(null);

  // drei <Sky> has no renderOrder prop in its types, and its disc size is a
  // shader constant; set both once (the replace is idempotent for StrictMode).
  useEffect(() => {
    const sky = ref.current;
    if (!sky) return;
    sky.renderOrder = RENDER_ORDER.sky;
    const mat = sky.material as ShaderMaterial;
    if (!mat.fragmentShader.includes("uDiscVisible")) {
      mat.fragmentShader =
        "uniform float uDiscVisible;\n" +
        mat.fragmentShader
          .replace(/sunAngularDiameterCos = [\d.]+;/, `sunAngularDiameterCos = ${SUN_COS.toFixed(10)};`)
          .replace("sunAngularDiameterCos + 0.00002", `sunAngularDiameterCos + ${SUN_EDGE.toFixed(10)}`)
          .replace("* sundisk;", "* sundisk * uDiscVisible;");
    }
    mat.uniforms.uDiscVisible = { value: 1 };
    mat.needsUpdate = true;
  }, []);

  useFrame(() => {
    const sky = ref.current;
    if (!sky) return;
    sky.visible = s.night < 0.995;
    if (!sky.visible) return;
    const u = (sky.material as ShaderMaterial).uniforms;
    (u.sunPosition.value as Vector3).copy(s.sunDir).multiplyScalar(100);
    u.turbidity.value = 1.6 + 6 * s.haze + 4 * s.overcast;
    u.rayleigh.value = MathUtils.lerp(1.6, 3.0, s.warmth);
    u.mieCoefficient.value = 0.0025 + 0.02 * s.haze;
    // The disc follows the REAL sun: its squeezed display position sits in the
    // ground haze's soft edge for a while after sunset.
    if (u.uDiscVisible) u.uDiscVisible.value = s.sunDisc;
  });

  return <Sky ref={ref} distance={3000} mieDirectionalG={0.86} />;
}
