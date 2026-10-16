import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, type Mesh, MathUtils, ShaderMaterial, Vector2 } from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { RENDER_ORDER } from "../core/constants";
import { projectToScreen, type ScreenPoint } from "../core/celestial";
import { LENS_FLARE_FRAG, LENS_FLARE_VERT } from "../shaders/lensFlare.glsl";

/** Display brightness of the sun's flare at full strength (tuned by eye). */
const SUN_GAIN = 0.11;
/** …and of a full moon's at night. */
const MOON_GAIN = 0.0225;
const MOON_TINT = new Color("#dfe7ff");
/** Cloud-cover taps around the source, frame heights. */
const TAP = 0.012;

const scratch = { color: new Color() };
const onScreen: ScreenPoint = { u: 0, v: 0, w: 0, offFrame: 0 };

interface LensFlareProps {
  source: "sun" | "moon";
}

/** Lens flare of the sun (by day) or the moon (by night); clouds over the source put it out. */
export function LensFlare({ source }: LensFlareProps) {
  const s = useSceneSignals();
  const ref = useRef<Mesh>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uClouds: { value: null },
          uSource: { value: new Vector2() },
          uTap: { value: new Vector2() },
          uAspect: { value: 1 },
          uColor: { value: new Color() },
          uSpikes: { value: 0 },
        },
        vertexShader: LENS_FLARE_VERT,
        fragmentShader: LENS_FLARE_FRAG,
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
    const sun = source === "sun";
    const dir = sun ? s.sunDir : s.moonDir;
    const altDeg = (sun ? s.sunAlt : s.moonAlt) * MathUtils.RAD2DEG;
    const { u, v, w, offFrame } = projectToScreen(dir, state.camera, onScreen);
    const weather = (1 - s.overcast) * (1 - MathUtils.smoothstep(s.haze, 0.35, 0.85));
    // Night, altitude and phase once each; clouds and haze come in through `weather`
    // (moonIntensity, the clouds' moonlight, already holds night and overcast).
    const body = sun
      ? MathUtils.smoothstep(altDeg, -1, 2)
      : s.night * MathUtils.smoothstep(s.moonFraction, 0.4, 1) * MathUtils.smoothstep(altDeg, 0, 3);
    const strength =
      w > 0 ? body * weather * (1 - MathUtils.smoothstep(offFrame, 0, 0.15)) * (sun ? SUN_GAIN : MOON_GAIN) : 0;
    mesh.visible = strength > 0.002;
    if (!mesh.visible) return;

    const aspect = state.size.width / state.size.height;
    const uniforms = material.uniforms;
    (uniforms.uSource.value as Vector2).set(u, v);
    (uniforms.uTap.value as Vector2).set(TAP / aspect, TAP);
    uniforms.uAspect.value = aspect;
    uniforms.uClouds.value = s.cloudCover;
    uniforms.uSpikes.value = sun ? 1 : 0.15;
    const color = sun ? scratch.color.copy(s.sunColor).convertLinearToSRGB() : scratch.color.copy(MOON_TINT);
    (uniforms.uColor.value as Color).copy(color).multiplyScalar(strength);
  });

  return (
    <mesh ref={ref} material={material} renderOrder={RENDER_ORDER.lensFlare} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
