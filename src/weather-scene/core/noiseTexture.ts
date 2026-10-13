import {
  DataTexture,
  LinearFilter,
  LinearMipMapLinearFilter,
  MathUtils,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three";

// Tileable 256×256 FBM (one channel), baked once on the CPU (~30 ms) and shared by
// the potato-tier cloud deck and the frost glass; tiling lets UVs scroll seamlessly.
// Assign it after UniformsUtils.merge, which would clone it.

const TEX_SIZE = 256;
const OCTAVES = 5;
const BASE_PERIOD = 4;
const SEED = 1337;

function hash2D(ix: number, iy: number, period: number, seed: number): number {
  const wx = ((ix % period) + period) % period;
  const wy = ((iy % period) + period) % period;
  let h = (wx * 374761393) ^ (wy * 668265263) ^ (seed * 1274126177);
  h = ((h >>> 0) * 2654435761) >>> 0;
  return h / 4294967296;
}

function valueNoise(
  x: number,
  y: number,
  period: number,
  seed: number,
): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const ux = xf * xf * (3 - 2 * xf);
  const uy = yf * yf * (3 - 2 * yf);
  const aa = hash2D(xi, yi, period, seed);
  const ba = hash2D(xi + 1, yi, period, seed);
  const ab = hash2D(xi, yi + 1, period, seed);
  const bb = hash2D(xi + 1, yi + 1, period, seed);
  const x1 = aa + ux * (ba - aa);
  const x2 = ab + ux * (bb - ab);
  return x1 + uy * (x2 - x1);
}

function fbm(x: number, y: number, octaves: number): number {
  let v = 0;
  let amp = 0.5;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    const f = 1 << i; // 1, 2, 4, 8, 16
    v += amp * valueNoise(x * f, y * f, BASE_PERIOD * f, SEED + i * 101);
    total += amp;
    amp *= 0.5;
  }
  return v / total;
}

let cached: DataTexture | null = null;

export function getCloudNoiseTexture(): DataTexture {
  if (cached) return cached;
  const data = new Uint8Array(TEX_SIZE * TEX_SIZE);
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Map pixel index → [0, BASE_PERIOD) so the highest-octave grid
      // divides evenly and every octave wraps inside the texture.
      const fx = (x / TEX_SIZE) * BASE_PERIOD;
      const fy = (y / TEX_SIZE) * BASE_PERIOD;
      const v = fbm(fx, fy, OCTAVES);
      data[y * TEX_SIZE + x] = MathUtils.clamp(Math.floor(v * 255), 0, 255);
    }
  }
  const tex = new DataTexture(
    data,
    TEX_SIZE,
    TEX_SIZE,
    RedFormat,
    UnsignedByteType,
  );
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipMapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
