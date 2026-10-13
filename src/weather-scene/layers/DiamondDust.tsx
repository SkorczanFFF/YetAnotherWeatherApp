import { useLayoutEffect, useMemo, useRef } from "react";
import { Sparkles } from "@react-three/drei";
import type { Material, Points } from "three";
import type { SceneParams } from "../../weather/sceneParams";
import { halfWidthAt, type ViewFrame } from "../core/viewVolume";
import { RENDER_ORDER } from "../core/constants";

interface DiamondDustProps {
  params: SceneParams;
  frame: ViewFrame;
  count: number;
}

/** Ice crystals glitter in very cold, clear, humid air. */
function hasDiamondDust(params: SceneParams): boolean {
  return (
    params.temperatureC <= -10 &&
    params.clouds.total < 0.5 &&
    params.humidity >= 0.7 &&
    params.precip.rainMmH === 0 &&
    params.precip.snowCmH === 0
  );
}

const DEPTH = 14;

/** drei <Sparkles> in a near box sized to the frame at that depth — nothing outside the view. */
export function DiamondDust({ params, frame, count }: DiamondDustProps) {
  const box = useMemo(() => {
    const top = DEPTH * frame.tanTop;
    const bottom = DEPTH * frame.tanBottom;
    const hw = halfWidthAt(frame, DEPTH, top);
    return {
      position: [0, (top + bottom) / 2, -DEPTH] as [number, number, number],
      scale: [hw * 2, top - bottom, 16] as [number, number, number],
    };
  }, [frame]);

  const ref = useRef<Points>(null);
  const active = hasDiamondDust(params);
  useLayoutEffect(() => {
    // Sparkles' shader tone-maps; with the scene's 0.5 exposure that turns
    // white glints into grey specks against a bright winter sky.
    const m = ref.current?.material as Material | undefined;
    if (m && m.toneMapped) {
      m.toneMapped = false;
      m.needsUpdate = true;
    }
  }, [active]);

  if (!active) return null;
  return (
    <Sparkles
      ref={ref}
      position={box.position}
      scale={box.scale}
      count={count}
      size={6}
      speed={0.15}
      opacity={1}
      color="#ffffff"
      noise={0.6}
      renderOrder={RENDER_ORDER.diamondDust}
    />
  );
}
