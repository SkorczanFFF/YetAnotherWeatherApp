import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { useSceneSignals } from "./sceneSignals";
import { MAX_DT } from "./constants";

interface UiBacklightProps {
  thunder: boolean;
}

const VAR = "--scene-light";
/** Approach rate towards the target, 1/s — slow enough to never flicker. */
const EASE = 1.2;
/** Only touch the DOM when the value moved this much. */
const STEP = 0.02;

/**
 * Estimates how bright the scene behind the UI is (0 night … 1 white overcast
 * or fog at noon) and writes it to `--scene-light` on <html>. The liquid-glass
 * cards darken their backdrop and thicken their tint with it, so white text
 * keeps its contrast over a bright sky. Mount after <SceneDriver>.
 */
export function UiBacklight({ thunder }: UiBacklightProps) {
  const s = useSceneSignals();
  const value = useRef(-1);
  const written = useRef(-1);

  useEffect(() => {
    const root = document.documentElement;
    return () => {
      root.style.removeProperty(VAR);
    };
  }, []);

  useFrame((_, delta) => {
    // A clear sky reads mid-bright; white cloud, haze or fog is the worst case.
    const whiteout = Math.max(s.cloudFill, s.haze);
    let target = s.day * MathUtils.lerp(0.55, 1, whiteout);
    if (thunder) target *= 0.55;

    value.current =
      value.current < 0
        ? target
        : MathUtils.damp(value.current, target, EASE, Math.min(delta, MAX_DT));

    if (Math.abs(value.current - written.current) >= STEP) {
      written.current = value.current;
      document.documentElement.style.setProperty(VAR, value.current.toFixed(2));
    }
  });

  return null;
}
