import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

interface FrameRateGateProps {
  /** Target fps cap. Defaults to 60. Set to 30 for further battery saving. */
  fps?: number;
}

/** Ignore rAF gaps longer than this when measuring the display (tab switches, hitches). */
const MAX_SAMPLE_MS = 100;

/**
 * Caps the R3F render rate by pairing `frameloop="demand"` on the parent
 * `<Canvas>` with a requestAnimationFrame-driven `invalidate()` loop.
 *
 * Why this exists: on a 240 Hz display with the default
 * `frameloop="always"`, the renderer runs at the monitor rate even when
 * nothing has meaningfully changed — four frames of compositor work per
 * frame of perceived change. On integrated GPUs this is a battery leak,
 * on discrete GPUs it's the difference between 60 W and 300 W.
 *
 * It renders every N-th display frame, with N = round(capInterval /
 * measuredFrameInterval) (≥ 1), so pacing is always even: 60 Hz → every
 * frame, 120/144 Hz → every 2nd, 240 Hz → every 4th, 60 Hz with a 30 cap →
 * every 2nd. Comparing elapsed time against 1000/fps instead (the old rule)
 * dropped frames at random whenever rAF jitter made a 60 Hz tick arrive a
 * hair early — ~39 fps with 33 ms hitches, which also tricked
 * PerformanceMonitor into lowering the quality tier.
 *
 * The gate lives INSIDE the Canvas so `useThree` can reach the store. It
 * does not render any geometry.
 */
export function FrameRateGate({ fps = 60 }: FrameRateGateProps) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const capInterval = 1000 / fps;
    let raf = 0;
    let prev = 0;
    // Start from the common 60 Hz assumption; converges within a few frames.
    let frameMs = 1000 / 60;
    let counter = 0;
    const tick = (t: number) => {
      if (prev !== 0) {
        const dt = t - prev;
        if (dt > 0 && dt < MAX_SAMPLE_MS) frameMs += (dt - frameMs) * 0.05;
      }
      prev = t;
      const every = Math.max(1, Math.round(capInterval / frameMs));
      if (counter % every === 0) invalidate();
      counter++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);

  return null;
}
