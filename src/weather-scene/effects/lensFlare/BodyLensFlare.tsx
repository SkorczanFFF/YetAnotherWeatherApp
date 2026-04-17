import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Vector2, Vector3 } from "three";
import { BlendFunction, EffectPass } from "postprocessing";
import { LensFlareEffect } from "@react-three/postprocessing";

// The library's <LensFlare> wrapper runs the effect's props through a
// `JSON.stringify(...restProps)` memoization key (@react-three/postprocessing
// v3.0.4, `P()` wrapper). Under React 19, `ref` is a regular prop for plain
// function components, so the internal ref to the mounted LensFlareEffect
// (which r3f decorates with a circular `__r3f` instance tree) ends up in that
// stringify call and throws "Converting circular structure to JSON".
//
// This wrapper builds the LensFlareEffect ourselves and wraps it in its own
// EffectPass mounted via <primitive>. Two LensFlareEffects merged into one
// EffectPass collide on the global `vec2 vTexCoord;` declared inside the
// library's fragment shader (uniforms are prefixed per-effect, locals are
// not), so each flare must live in a separate pass. Animated values are
// driven through refs, so the component renders exactly once.

export interface BodyLensFlareConfig {
  glareSize: number;
  flareSize: number;
  starPoints: number;
  flareSpeed: number;
  anamorphic: boolean;
  secondaryGhosts: boolean;
  starBurst: boolean;
  animated: boolean;
  haloScale: number;
  ghostScale: number;
  initialColor: Color;
}

interface BodyLensFlareProps {
  worldPositionRef: React.RefObject<Vector3>;
  opacityRef: React.RefObject<number>;
  colorGainRef: React.RefObject<Color>;
  config: BodyLensFlareConfig;
}

export function BodyLensFlare({
  worldPositionRef,
  opacityRef,
  colorGainRef,
  config,
}: BodyLensFlareProps) {
  const camera = useThree((s) => s.camera);

  const { effect, pass } = useMemo(() => {
    const fx = new LensFlareEffect({
      blendFunction: BlendFunction.NORMAL,
      enabled: true,
      glareSize: config.glareSize,
      lensPosition: new Vector3(),
      screenRes: new Vector2(),
      starPoints: config.starPoints,
      flareSize: config.flareSize,
      flareSpeed: config.flareSpeed,
      flareShape: 0.01,
      animated: config.animated,
      anamorphic: config.anamorphic,
      colorGain: config.initialColor.clone(),
      lensDirtTexture: null,
      haloScale: config.haloScale,
      secondaryGhosts: config.secondaryGhosts,
      aditionalStreaks: true,
      ghostScale: config.ghostScale,
      opacity: 0,
      starBurst: config.starBurst,
    });
    const p = new EffectPass(camera, fx);
    return { effect: fx, pass: p };
    // Config is considered stable at mount; runtime values flow through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useEffect(
    () => () => {
      (pass as unknown as { dispose?: () => void }).dispose?.();
      (effect as unknown as { dispose?: () => void }).dispose?.();
    },
    [effect, pass],
  );

  const ndcRef = useRef(new Vector3());

  useFrame((state, delta) => {
    const u = effect.uniforms;
    const uScreenRes = u.get("screenRes");
    const uLensPos = u.get("lensPosition");
    const uOpacity = u.get("opacity");
    const uColorGain = u.get("colorGain");
    const uTime = u.get("time");

    if (uScreenRes) uScreenRes.value.set(state.size.width, state.size.height);
    if (uTime) uTime.value += delta;

    const world = worldPositionRef.current;
    const ndc = ndcRef.current;
    if (world) {
      ndc.copy(world).project(state.camera);
      if (uLensPos) {
        uLensPos.value.x = ndc.x;
        uLensPos.value.y = ndc.y;
      }
      const behind = ndc.z > 1;
      const clipped = Math.abs(ndc.x) > 1.2 || Math.abs(ndc.y) > 1.2;
      const target = behind || clipped ? 0 : opacityRef.current ?? 0;
      if (uOpacity) uOpacity.value = target;
    } else if (uOpacity) {
      uOpacity.value = 0;
    }

    const gain = colorGainRef.current;
    if (uColorGain && gain) uColorGain.value.copy(gain);
  });

  return <primitive object={pass} dispose={null} />;
}
