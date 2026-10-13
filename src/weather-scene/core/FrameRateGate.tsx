import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

interface FrameRateGateProps {
  /** Target fps cap. */
  fps: number;
}

/** Ignore rAF gaps longer than this when measuring the display (tab switches, hitches). */
const MAX_SAMPLE_MS = 100;

/**
 * Caps the render rate; pairs with `frameloop="demand"` (without it the scene
 * renders at monitor rate). Invalidates every N-th rAF tick, N from the measured
 * display interval, so pacing stays even. Never gate on elapsed ≥ 1000/fps: rAF
 * jitter drops random frames and PerformanceMonitor then lowers the tier.
 */
export function FrameRateGate({ fps }: FrameRateGateProps) {
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
