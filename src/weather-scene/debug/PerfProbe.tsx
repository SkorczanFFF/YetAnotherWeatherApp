import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { perfStats } from "./perfStats";

/**
 * Samples renderer.info and fps twice a second. Offscreen passes (volumetric
 * clouds) call gl.render() inside useFrame, which would reset the counters
 * mid-frame, so auto-reset is off while the probe is mounted and the probe
 * resets once per frame itself: each reading = previous main render + this
 * frame's offscreen passes, i.e. one full frame.
 */
export function PerfProbe() {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);

  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((_state, delta) => {
    frames.current++;
    elapsed.current += delta;
    const info = gl.info.render;
    perfStats.calls = info.calls;
    perfStats.triangles = info.triangles;
    perfStats.points = info.points;
    gl.info.reset();
    if (elapsed.current >= 0.5) {
      perfStats.fps = Math.round(frames.current / elapsed.current);
      frames.current = 0;
      elapsed.current = 0;
    }
  });

  return null;
}
