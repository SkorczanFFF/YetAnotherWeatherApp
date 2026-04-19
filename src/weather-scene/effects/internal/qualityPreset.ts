import type { CloudsQualityPreset } from "@takram/three-clouds";

export type QualityTier = "low" | "medium" | "high" | "ultra";

export interface RuntimePreset {
  tier: QualityTier;
  cloudsPreset: CloudsQualityPreset;
  resolutionScale: number;
  godRaysSamples: number;
  godRaysEnabled: boolean;
  moonFlareEnabled: boolean;
}

// The volumetric clouds pass is the dominant GPU cost in this scene. Each
// tier here trades off against that pass specifically:
//   - cloudsPreset    selects three-clouds' internal iteration counts and
//                     disables light shafts / shape detail / turbulence at
//                     lower tiers.
//   - resolutionScale scales the clouds fullscreen pass only; the main scene
//                     still renders at 1.0.
// Defaults are conservative so a mid-range laptop doesn't feel the fan kick
// in — users with desktop GPUs can still be pushed to "high" if we add an
// explicit toggle later.
const PRESETS: Record<QualityTier, RuntimePreset> = {
  low: {
    tier: "low",
    cloudsPreset: "low",
    resolutionScale: 0.3,
    godRaysSamples: 0,
    godRaysEnabled: false,
    moonFlareEnabled: false,
  },
  medium: {
    tier: "medium",
    cloudsPreset: "medium",
    resolutionScale: 0.55,
    godRaysSamples: 40,
    godRaysEnabled: true,
    moonFlareEnabled: true,
  },
  high: {
    tier: "high",
    cloudsPreset: "high",
    resolutionScale: 0.85,
    godRaysSamples: 80,
    godRaysEnabled: true,
    moonFlareEnabled: true,
  },
  ultra: {
    tier: "ultra",
    cloudsPreset: "ultra",
    resolutionScale: 1,
    godRaysSamples: 128,
    godRaysEnabled: true,
    moonFlareEnabled: true,
  },
};

type GPUClass = "integrated" | "discrete" | "unknown";

// Sniff the WebGL renderer string to tell an integrated GPU from a discrete
// one. `navigator.hardwareConcurrency` lies for our purposes — modern laptop
// CPUs (i9-13900H, Ryzen 9) report 14–20 cores while running on Iris Xe /
// Radeon integrated graphics that can't handle the `high` preset. The GPU
// string is the only signal tied to actual fragment-shader throughput.
// WEBGL_debug_renderer_info is restricted in some browsers (privacy mode,
// Firefox RFP) — "unknown" is the privacy-preserving fallback and we treat
// it as integrated-equivalent to stay safe.
function detectGPUClass(): GPUClass {
  if (typeof document === "undefined") return "unknown";
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) return "unknown";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "unknown";
    const raw = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
    const r = raw.toLowerCase();
    // Discrete wins over integrated when both tokens appear — some drivers
    // report e.g. "Intel(R) UHD Graphics ... NVIDIA GeForce RTX"-style
    // mashups. Order matters here.
    if (/\b(rtx|gtx|geforce|quadro|radeon rx|radeon pro|radeon r[79])\b/.test(r)) {
      return "discrete";
    }
    if (/\b(apple m\d|apple gpu)\b/.test(r)) {
      // M-series integrated is strong enough to treat as discrete for our
      // workload — unified memory + decent bandwidth.
      return "discrete";
    }
    if (/intel|iris|uhd graphics|hd graphics|adreno|mali|powervr|vivante|swiftshader|angle/.test(r)) {
      return "integrated";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function detectQualityTier(): QualityTier {
  if (typeof navigator === "undefined") return "low";
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const mobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobileUA) return "low";
  // Integrated GPUs top out at "low" no matter how many CPU cores the
  // machine reports. A 20-thread i9 mobile CPU still chokes on Iris Xe.
  const gpu = detectGPUClass();
  if (gpu !== "discrete") return "low";
  if (cores <= 4 || dpr >= 2) return "low";
  if (cores <= 8) return "medium";
  return "high";
}

export function getRuntimePreset(tier: QualityTier = detectQualityTier()): RuntimePreset {
  return PRESETS[tier];
}
