import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, type Mesh, ShaderMaterial } from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { SKY_GRADE_FRAG, SKY_GRADE_VERT } from "../shaders/skyGrade.glsl";

const NIGHT_ZENITH = new Color("#05081a");
const NIGHT_HORIZON = new Color("#172443");
const OVERCAST_DAY = new Color("#b2bac4");
const OVERCAST_NIGHT = new Color("#1a1e27");

/** Night gradient + overcast + horizon haze + flash, over drei <Sky>. One draw. */
export function SkyGrade() {
  const s = useSceneSignals();
  const ref = useRef<Mesh>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uNightZenith: { value: NIGHT_ZENITH.clone() },
          uNightHorizon: { value: NIGHT_HORIZON.clone() },
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
    u.uNight.value = s.night;
    u.uOvercast.value = s.overcast * 0.9;
    u.uHaze.value = s.haze;
    u.uFlash.value = s.flash;
    (u.uOvercastColor.value as Color).copy(OVERCAST_DAY).lerp(OVERCAST_NIGHT, s.night);
    (u.uHazeColor.value as Color).copy(s.horizonColor);
  });

  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[10, 32, 16]} />
    </mesh>
  );
}
