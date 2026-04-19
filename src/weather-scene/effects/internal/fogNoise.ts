import * as THREE from "three";

function hash(x: number, y: number): [number, number] {
  const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  const b = Math.sin(x * 269.5 + y * 183.3) * 43758.5453;
  return [a - Math.floor(a), b - Math.floor(b)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function gradientNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fade(fx);
  const uy = fade(fy);

  const dot = (gx: number, gy: number, dx: number, dy: number) =>
    (gx * 2 - 1) * dx + (gy * 2 - 1) * dy;

  const g00 = hash(ix, iy);
  const g10 = hash(ix + 1, iy);
  const g01 = hash(ix, iy + 1);
  const g11 = hash(ix + 1, iy + 1);

  const n00 = dot(g00[0], g00[1], fx, fy);
  const n10 = dot(g10[0], g10[1], fx - 1, fy);
  const n01 = dot(g01[0], g01[1], fx, fy - 1);
  const n11 = dot(g11[0], g11[1], fx - 1, fy - 1);

  return lerp(lerp(n00, n10, ux), lerp(n01, n11, ux), uy);
}

function fbm(x: number, y: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * gradientNoise(px, py);
    px *= 2;
    py *= 2;
    amplitude *= 0.5;
  }
  return value;
}

const FOG_NOISE_SIZE = 128;

let cachedTexture: THREE.DataTexture | null = null;

export function getFogNoiseTexture(): THREE.DataTexture {
  if (cachedTexture) return cachedTexture;

  const size = FOG_NOISE_SIZE;
  const data = new Uint8Array(size * size);
  const scale = 4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * scale;
      const ny = (y / size) * scale;
      const n = fbm(nx, ny, 3);
      const mapped = Math.min(255, Math.max(0, Math.floor(((n + 0.75) / 1.5) * 255)));
      data[y * size + x] = mapped;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  cachedTexture = texture;
  return texture;
}
