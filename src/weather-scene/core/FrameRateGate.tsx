import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

interface FrameRateGateProps {
  /** Target fps cap. Defaults to 60. Set to 30 for further battery saving. */
  fps?: number;
}

/**
 * Caps the R3F render rate by pairing `frameloop="demand"` on the parent
 * `<Canvas>` with a requestAnimationFrame-throttled `invalidate()` loop.
 *
 * Why this exists: on a 240 Hz display with the default
 * `frameloop="always"`, the renderer runs at the monitor rate even when
 * nothing has meaningfully changed — four frames of compositor work per
 * frame of perceived change. On integrated GPUs this is a battery leak,
 * on discrete GPUs it's the difference between 60 W and 300 W.
 *
 * The gate lives INSIDE the Canvas so `useThree` can reach the store. It
 * does not render any geometry.
 */
export function FrameRateGate({ fps = 60 }: FrameRateGateProps) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const interval = 1000 / fps;
    let last = 0;
    let raf = 0;
    const tick = (t: number) => {
      // Fire immediately on the first tick so the first frame renders
      // without waiting a full interval.
      if (last === 0 || t - last >= interval) {
        invalidate();
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);

  return null;
}
