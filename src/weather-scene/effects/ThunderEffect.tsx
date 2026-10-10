import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import type { SimulationConfig } from "../types";

interface ThunderEffectProps {
  config: SimulationConfig;
  /** Ref to <SkyDome>'s material so we can modulate its uFlash uniform. */
  skyMaterialRef: React.MutableRefObject<ShaderMaterial | null>;
  isMobile?: boolean;
}

// Randomly-timed lightning flashes. No extra draw call — we drive the
// SkyDome's existing uFlash uniform (defined in skyDome.glsl) directly
// through the shared ref. Flash profile is a sharp attack + exponential
// decay, optionally a second smaller bump 80 ms later for realistic
// double-flash.

const MIN_INTERVAL_S = 4;
const MAX_INTERVAL_S = 12;
const FLASH_DURATION_S = 0.22;
const SECOND_BUMP_CHANCE = 0.5;

export function ThunderEffect({
  skyMaterialRef,
  isMobile = false,
}: ThunderEffectProps) {
  const phaseRef = useRef<"idle" | "flashing">("idle");
  const nextFlashRef = useRef(0);
  const flashStartRef = useRef(0);
  const secondBumpAtRef = useRef(-1);
  const peakIntensityRef = useRef(0);

  useEffect(() => {
    // Schedule the first flash 1-3s from mount so the user notices it's
    // stormy.
    nextFlashRef.current = performance.now() / 1000 + 1 + Math.random() * 2;
  }, []);

  useFrame((state) => {
    const mat = skyMaterialRef.current;
    if (!mat || !mat.uniforms.uFlash) return;
    const t = state.clock.elapsedTime;

    if (phaseRef.current === "idle") {
      if (t >= nextFlashRef.current) {
        phaseRef.current = "flashing";
        flashStartRef.current = t;
        peakIntensityRef.current = isMobile ? 0.7 : 1.0;
        secondBumpAtRef.current =
          Math.random() < SECOND_BUMP_CHANCE ? t + 0.08 : -1;
      } else {
        mat.uniforms.uFlash.value = 0;
        return;
      }
    }

    // flashing state — compute envelope
    const elapsed = t - flashStartRef.current;
    let env = 0;
    if (elapsed < FLASH_DURATION_S) {
      // Sharp attack (first 15 ms), exponential decay.
      const attack = Math.min(1, elapsed / 0.015);
      const decay = Math.exp(-elapsed * 18);
      env = attack * decay;
    }
    // Second bump — smaller secondary flash 80 ms into the event.
    if (secondBumpAtRef.current > 0 && t >= secondBumpAtRef.current) {
      const bumpElapsed = t - secondBumpAtRef.current;
      if (bumpElapsed < FLASH_DURATION_S) {
        const attack = Math.min(1, bumpElapsed / 0.012);
        const decay = Math.exp(-bumpElapsed * 22);
        env += attack * decay * 0.55;
      }
    }

    mat.uniforms.uFlash.value = env * peakIntensityRef.current;

    // End of flashing phase — schedule next.
    const endedAt = Math.max(
      flashStartRef.current + FLASH_DURATION_S,
      secondBumpAtRef.current + FLASH_DURATION_S,
    );
    if (t >= endedAt) {
      phaseRef.current = "idle";
      mat.uniforms.uFlash.value = 0;
      nextFlashRef.current =
        t + MIN_INTERVAL_S + Math.random() * (MAX_INTERVAL_S - MIN_INTERVAL_S);
    }
  });

  return null;
}
