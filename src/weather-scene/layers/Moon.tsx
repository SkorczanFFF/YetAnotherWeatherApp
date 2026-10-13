import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  Color,
  type Mesh,
  MathUtils,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { MOON_FRAG, MOON_VERT } from "../shaders/moon.glsl";
import { RENDER_ORDER } from "../core/constants";

const DISTANCE = 1400;
/** Drawn ~4× the real 0.5° so it reads at phone sizes. */
const ANGULAR_DIAMETER = MathUtils.degToRad(2.2);
const SIZE = 2 * DISTANCE * Math.tan(ANGULAR_DIAMETER / 2);

/** Textured moon with the real phase; the lit limb faces the on-screen sun. */
export function Moon() {
  const s = useSceneSignals();
  const ref = useRef<Mesh>(null);
  const map = useTexture("/effects/moon.jpg");
  const scratch = useMemo(
    () => ({ sun: new Vector3(), moon: new Vector3(), dir2d: new Vector2() }),
    [],
  );

  const material = useMemo(() => {
    map.colorSpace = SRGBColorSpace;
    return new ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uSunDir2D: { value: new Vector2(1, 0) },
        uPhaseAngle: { value: Math.PI },
        uOpacity: { value: 0 },
        uTint: { value: new Color("#f4f1ea") },
      },
      vertexShader: MOON_VERT,
      fragmentShader: MOON_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  }, [map]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    // Daytime moon is pale and only shows when enough of it is lit (a thin
    // crescent next to the sun is lost in the glare); clouds and haze hide it.
    const above = MathUtils.smoothstep(s.moonAlt * MathUtils.RAD2DEG, -1, 2);
    const dayVisibility = 0.45 * MathUtils.smoothstep(s.moonFraction, 0.05, 0.35);
    const opacity =
      above *
      MathUtils.lerp(dayVisibility, 1, s.night) *
      (1 - s.overcast) *
      (1 - s.haze * 0.85);
    mesh.visible = opacity > 0.01;
    if (!mesh.visible) return;

    const camera = state.camera;
    mesh.position.copy(camera.position).addScaledVector(s.moonDir, DISTANCE);
    mesh.quaternion.copy(camera.quaternion);

    // Sun direction relative to the moon, in camera space.
    const inv = camera.matrixWorldInverse;
    scratch.sun.copy(s.sunDir).transformDirection(inv);
    scratch.moon.copy(s.moonDir).transformDirection(inv);
    scratch.dir2d.set(scratch.sun.x - scratch.moon.x, scratch.sun.y - scratch.moon.y);
    if (scratch.dir2d.lengthSq() < 1e-8) scratch.dir2d.set(1, 0);
    (material.uniforms.uSunDir2D.value as Vector2).copy(scratch.dir2d.normalize());
    material.uniforms.uPhaseAngle.value = s.moonPhase * Math.PI * 2;
    material.uniforms.uOpacity.value = opacity;
  });

  return (
    <mesh ref={ref} material={material} renderOrder={RENDER_ORDER.moon} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
