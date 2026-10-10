import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { perfStats } from "./perfStats";

/** Samples renderer.info (previous frame — useFrame runs before render) and fps twice a second. */
export function PerfProbe() {
  const frames = useRef(0);
  const elapsed = useRef(0);

  useFrame((state, delta) => {
    frames.current++;
    elapsed.current += delta;
    const info = state.gl.info.render;
    perfStats.calls = info.calls;
    perfStats.triangles = info.triangles;
    perfStats.points = info.points;
    if (elapsed.current >= 0.5) {
      perfStats.fps = Math.round(frames.current / elapsed.current);
      frames.current = 0;
      elapsed.current = 0;
    }
  });

  return null;
}
