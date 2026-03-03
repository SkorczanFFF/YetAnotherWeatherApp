/** Cached sky gradient textures for SkyBackground. */
import * as THREE from "three";

interface GradientStop {
  offset: number;
  color: string;
}

function createGradientTexture(
  stops: GradientStop[],
  flipY = false,
): THREE.CanvasTexture {
  const w = 4,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const stop of stops) {
    g.addColorStop(stop.offset, stop.color);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = flipY;
  return tex;
}

const SKY_GRADIENTS: Record<string, { stops: GradientStop[]; flipY?: boolean }> = {
  day: {
    stops: [
      { offset: 0, color: "#2E6FA8" },
      { offset: 1, color: "#0C427D" },
    ],
  },
  night: {
    stops: [
      { offset: 0, color: "#06060A" },
      { offset: 0.4, color: "#06060A" },
      { offset: 0.65, color: "#091824" },
      { offset: 1, color: "#0D2132" },
    ],
    flipY: true,
  },
  dawn: {
    stops: [
      { offset: 0, color: "#d67809" },
      { offset: 1, color: "#f5843d" },
    ],
  },
  dusk: {
    stops: [
      { offset: 0, color: "#FFB47A" },
      { offset: 0.5, color: "#FF8A5C" },
      { offset: 1, color: "#5A4A7A" },
    ],
  },
};

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getSkyTexture(phase: string): THREE.CanvasTexture {
  const cached = textureCache.get(phase);
  if (cached) return cached;
  const config = SKY_GRADIENTS[phase] ?? SKY_GRADIENTS.day;
  const tex = createGradientTexture(config.stops, config.flipY);
  textureCache.set(phase, tex);
  return tex;
}

export const SKY_COLORS: Record<string, number> = {
  night: 0x0a0a1a,
  dawn: 0xfe964c,
  day: 0x0c427d,
  dusk: 0xff7b4a,
};

export const STORM_SKY_COLOR = 0x2a3542;

/** Thunderstorm sky: night uses solid color; day/dawn/dusk use gradients. */
const STORM_SKY_GRADIENTS: Record<string, { stops: GradientStop[]; flipY?: boolean }> = {
  day: {
    stops: [
      { offset: 0, color: "#9fa6ad" },
      { offset: 1, color: "#b7c1cc" },
    ],
  },
  dawn: {
    stops: [
      { offset: 0, color: "#3d4045" },
      { offset: 0.5, color: "#2a2d32" },
      { offset: 1, color: "#1e2126" },
    ],
  },
  dusk: {
    stops: [
      { offset: 0, color: "#2a2d32" },
      { offset: 0.5, color: "#1e2126" },
      { offset: 1, color: "#25282e" },
    ],
  },
  night: {
    stops: [
      { offset: 0, color: "#2a3542" },
      { offset: 1, color: "#2a3542" },
    ],
  },
};

const stormTextureCache = new Map<string, THREE.CanvasTexture>();

export function getStormSkyTexture(phase: string): THREE.Texture | THREE.Color {
  if (phase === "night") {
    return new THREE.Color(STORM_SKY_COLOR);
  }
  const cached = stormTextureCache.get(phase);
  if (cached) return cached;
  const config = STORM_SKY_GRADIENTS[phase] ?? STORM_SKY_GRADIENTS.day;
  const tex = createGradientTexture(config.stops, config.flipY);
  stormTextureCache.set(phase, tex);
  return tex;
}
