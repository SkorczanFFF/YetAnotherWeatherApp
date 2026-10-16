import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, type Mesh, MathUtils, ShaderMaterial } from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { SKY_GRADE_FRAG, SKY_GRADE_VERT } from "../shaders/skyGrade.glsl";
import { RENDER_ORDER } from "../core/constants";
import {
  SKY_NIGHT_HORIZON,
  SKY_NIGHT_ZENITH,
  SKY_OVERCAST_DAY,
  SKY_OVERCAST_DUSK,
  SKY_OVERCAST_NIGHT,
} from "../core/palette";

/** One-draw sky overlay over drei <Sky> (see shaders/skyGrade.glsl.ts). */
export function SkyGrade() {
  const s = useSceneSignals();
  const ref = useRef<Mesh>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uNightZenith: { value: SKY_NIGHT_ZENITH.clone() },
          uNightHorizon: { value: SKY_NIGHT_HORIZON.clone() },
          uOvercastColor: { value: new Color() },
          uHazeColor: { value: new Color() },
          uNight: { value: 0 },
          uOvercast: { value: 0 },
          uHaze: { value: 0 },
          uFlash: { value: 0 },
        },
        vertexShader: SKY_GRADE_VERT,
        fragmentShader: SKY_GRADE_FRAG,
        side: BackSide,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    ref.current?.position.copy(state.camera.position);
    const u = material.uniforms;
    // Blue hour: the night gradient comes in from sunset (≤ 75 % by −6°) —
    // Preetham's sky alone went a dull dark grey in late twilight.
    const blueHour = 1 - MathUtils.smoothstep(s.sunAltDeg, -6, -0.5);
    u.uNight.value = Math.max(s.night, 0.75 * blueHour);
    u.uOvercast.value = s.overcast * 0.9;
    u.uHaze.value = s.haze;
    u.uFlash.value = s.flash;
    (u.uOvercastColor.value as Color)
      .copy(SKY_OVERCAST_DAY)
      .lerp(SKY_OVERCAST_DUSK, s.lowSun)
      .lerp(SKY_OVERCAST_NIGHT, s.night);
    (u.uHazeColor.value as Color).copy(s.horizonColor);
  });

  return (
    <mesh ref={ref} material={material} renderOrder={RENDER_ORDER.skyGrade} frustumCulled={false}>
      <sphereGeometry args={[10, 32, 16]} />
    </mesh>
  );
}
