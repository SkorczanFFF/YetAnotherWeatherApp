import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, type Mesh, ShaderMaterial } from "three";
import { getFrostAmount } from "../../weather/frost";
import type { SceneParams } from "../../weather/sceneParams";
import { getCloudNoiseTexture } from "../core/noiseTexture";
import { useSceneSignals } from "../core/sceneSignals";
import { FROST_FRAG } from "../shaders/frost.glsl";
import { fullscreenVert } from "../shaders/fullscreen.glsl";
import { MAX_DT, RENDER_ORDER } from "../core/constants";

interface FrostGlassProps {
  params: SceneParams;
}

const DAY_TINT = new Color("#e9f2fb");
const NIGHT_TINT = new Color("#5d6b82");
/** Growth / melt speed of the frost, amount per second. */
const GROW_RATE = 0.12;
const MELT_RATE = 0.25;

/**
 * Procedural frosted pane over the scene (under the UI, so cards stay readable), easing
 * towards getFrostAmount() instead of snapping (see CLAUDE.md › Non-obvious gotchas).
 */
export function FrostGlass({ params }: FrostGlassProps) {
  const s = useSceneSignals();
  const ref = useRef<Mesh>(null);
  const amount = useRef(0);
  const size = useThree((state) => state.size);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uNoise: { value: null },
          uAmount: { value: 0 },
          uAspect: { value: 1 },
          uTint: { value: new Color() },
        },
        vertexShader: fullscreenVert(),
        fragmentShader: FROST_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const target = getFrostAmount(params);

  useFrame((_state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(delta, MAX_DT);
    const diff = target - amount.current;
    const step = (diff > 0 ? GROW_RATE : MELT_RATE) * dt;
    amount.current += Math.sign(diff) * Math.min(Math.abs(diff), step);
    mesh.visible = amount.current > 0.003;
    if (!mesh.visible) return;
    const u = material.uniforms;
    // Baked (~30 ms CPU) the first time frost shows, not on every page load.
    u.uNoise.value ??= getCloudNoiseTexture();
    u.uAmount.value = amount.current;
    u.uAspect.value = size.width / Math.max(1, size.height);
    (u.uTint.value as Color).copy(DAY_TINT).lerp(NIGHT_TINT, s.night * 0.8);
  });

  return (
    <mesh ref={ref} material={material} renderOrder={RENDER_ORDER.frost} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
