import { DataTexture, LinearFilter, RGBAFormat } from "three";

// White-RGB + alpha DataTextures, not canvas textures: some GPU paths upload canvas
// pixels premultiplied (grey edges). quarks' shader has no colour-space conversion,
// so they stay in "no colour space".

function makeAlphaTexture(width: number, height: number, alpha: Uint8Array): DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = alpha[i];
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

let dot: DataTexture | null = null;

/** Soft round dot — stretched into rain streaks, used as-is for hail and snow grains. */
export function getDotTexture(): DataTexture {
  if (dot) return dot;
  const size = 64;
  const alpha = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = r < 0.35 ? 1 - (r / 0.35) * 0.2 : Math.max(0, 0.8 * (1 - (r - 0.35) / 0.65));
      alpha[y * size + x] = Math.round(a * 255);
    }
  }
  dot = makeAlphaTexture(size, size, alpha);
  return dot;
}

let snow: DataTexture | null = null;
export const SNOW_TILES = 3;
const TILE = 64;

/**
 * 3×1 atlas of public/effects/snowflake1–3.png (alpha only). Starts as soft
 * dots and fills in each tile once its PNG has loaded — no Suspense needed.
 */
export function getSnowAtlas(): DataTexture {
  if (snow) return snow;
  const width = TILE * SNOW_TILES;
  const alpha = new Uint8Array(width * TILE);
  const dotAlpha = getDotTexture().image.data as Uint8Array;
  for (let t = 0; t < SNOW_TILES; t++) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        alpha[y * width + t * TILE + x] = dotAlpha[(y * TILE + x) * 4 + 3];
      }
    }
  }
  const texture = makeAlphaTexture(width, TILE, alpha);
  const data = texture.image.data as Uint8Array;

  for (let t = 0; t < SNOW_TILES; t++) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = TILE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, TILE, TILE);
      // getImageData is un-premultiplied; only alpha is used anyway.
      const px = ctx.getImageData(0, 0, TILE, TILE).data;
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          // DataTexture rows run bottom-up; canvas rows top-down.
          data[((TILE - 1 - y) * width + t * TILE + x) * 4 + 3] = px[(y * TILE + x) * 4 + 3];
        }
      }
      texture.needsUpdate = true;
    };
    img.src = `/effects/snowflake${t + 1}.png`;
  }
  snow = texture;
  return texture;
}
