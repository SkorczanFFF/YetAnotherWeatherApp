import type {
  PerspectiveCamera,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const DISC_SAMPLES: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const theta = i * GOLDEN_ANGLE;
    const r = Math.sqrt(i / 8);
    out.push([r * Math.cos(theta), r * Math.sin(theta)]);
  }
  return out;
})();

/**
 * Read a tiny square around the sun's projected screen position from a render
 * target, then average a Vogel-disc sample of pixels to produce a 0..1
 * occlusion value. `target` is typically the cloud density / cloud-colour
 * buffer exposed by the volumetric cloud effect.
 *
 * Returns 0 when the sun is off-screen (caller decides whether to decay to
 * clear or hold). Buffer must be length `(2*radiusPx)^2 * 4` and is reused.
 */
export function readOcclusionAtWorldPos(
  renderer: WebGLRenderer,
  target: WebGLRenderTarget,
  camera: PerspectiveCamera,
  worldPos: Vector3,
  radiusPx: number,
  buffer: Uint8Array,
  scratchNDC: Vector3,
): number {
  scratchNDC.copy(worldPos).project(camera);
  if (
    scratchNDC.x < -1 ||
    scratchNDC.x > 1 ||
    scratchNDC.y < -1 ||
    scratchNDC.y > 1 ||
    scratchNDC.z < -1 ||
    scratchNDC.z > 1
  ) {
    return 0;
  }
  const tw = target.width;
  const th = target.height;
  const cx = Math.round((scratchNDC.x * 0.5 + 0.5) * tw);
  const cy = Math.round((-scratchNDC.y * 0.5 + 0.5) * th);
  const size = radiusPx * 2;
  const x = Math.max(0, Math.min(tw - size, cx - radiusPx));
  const y = Math.max(0, Math.min(th - size, cy - radiusPx));
  try {
    renderer.readRenderTargetPixels(target, x, y, size, size, buffer);
  } catch {
    return 0;
  }

  let acc = 0;
  for (let i = 0; i < DISC_SAMPLES.length; i++) {
    const [sx, sy] = DISC_SAMPLES[i];
    const ix = Math.max(0, Math.min(size - 1, Math.round(radiusPx + sx * radiusPx)));
    const iy = Math.max(0, Math.min(size - 1, Math.round(radiusPx + sy * radiusPx)));
    const idx = (iy * size + ix) * 4;
    // Use alpha as occlusion when present, else red channel.
    const alpha = buffer[idx + 3];
    const red = buffer[idx];
    acc += (alpha > 0 ? alpha : red) / 255;
  }
  return acc / DISC_SAMPLES.length;
}
