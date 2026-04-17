import type { Texture, WebGLRenderTarget } from "three";

/**
 * Defensive accessors for the volumetric cloud effect's internal render
 * targets. `@takram/three-clouds` is pre-1.0 and these names may shift. One
 * file, one try/catch — a breaking upstream change fails loudly here rather
 * than leaking into call sites.
 */

interface MaybeCloudsEffect {
  cloudsPass?: {
    currentRenderTarget?: WebGLRenderTarget;
    renderTarget?: WebGLRenderTarget;
  };
  shadowPass?: {
    currentRenderTarget?: WebGLRenderTarget;
    renderTarget?: WebGLRenderTarget;
  };
  shadowMaps?: {
    texture?: Texture;
  };
}

export function getCloudsRenderTarget(effect: unknown): WebGLRenderTarget | null {
  try {
    const e = effect as MaybeCloudsEffect;
    return e?.cloudsPass?.currentRenderTarget ?? e?.cloudsPass?.renderTarget ?? null;
  } catch {
    return null;
  }
}

export function getCloudShadowMapTexture(effect: unknown): Texture | null {
  try {
    const e = effect as MaybeCloudsEffect;
    return e?.shadowMaps?.texture ?? null;
  } catch {
    return null;
  }
}
