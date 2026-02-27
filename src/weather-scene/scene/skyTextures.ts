/**
 * Cached sky gradient textures for R3F SkyBackground.
 */

import * as THREE from "three";

function createDayTexture(): THREE.CanvasTexture {
  const w = 4,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#2E6FA8");
  g.addColorStop(1, "#0C427D");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  return tex;
}

function createNightTexture(): THREE.CanvasTexture {
  const w = 4,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#06060A");
  g.addColorStop(0.4, "#06060A");
  g.addColorStop(0.65, "#091824");
  g.addColorStop(1, "#0D2132");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  return tex;
}

function createDawnTexture(): THREE.CanvasTexture {
  const w = 4,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  // Softer, cooler pre-sunrise gradient than dusk
  g.addColorStop(0, "#FFB47A");
  g.addColorStop(0.5, "#FF8A5C");
  g.addColorStop(1, "#5A4A7A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  return tex;
}

function createDuskTexture(): THREE.CanvasTexture {
  const w = 4,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#FDAF53");
  g.addColorStop(1, "#FE964C");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  return tex;
}

let dayTex: THREE.CanvasTexture | null = null;
let nightTex: THREE.CanvasTexture | null = null;
let dawnTex: THREE.CanvasTexture | null = null;
let duskTex: THREE.CanvasTexture | null = null;

export function getDaySkyTexture(): THREE.CanvasTexture {
  if (!dayTex) dayTex = createDayTexture();
  return dayTex;
}

export function getNightSkyTexture(): THREE.CanvasTexture {
  if (!nightTex) nightTex = createNightTexture();
  return nightTex;
}

export function getDawnSkyTexture(): THREE.CanvasTexture {
  if (!dawnTex) dawnTex = createDawnTexture();
  return dawnTex;
}

export function getDuskSkyTexture(): THREE.CanvasTexture {
  if (!duskTex) duskTex = createDuskTexture();
  return duskTex;
}

export const SKY_COLORS: Record<string, number> = {
  night: 0x0a0a1a,
  dawn: 0xff7b4a,
  day: 0x0c427d,
  dusk: 0xfe964c,
};

export const STORM_SKY_COLOR = 0x2a3542;
