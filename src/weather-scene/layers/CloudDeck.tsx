import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  type Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
} from "three";
import { deckCover } from "../../weather/cloudPhysics";
import type { SceneParams } from "../../weather/sceneParams";
import { getCloudNoiseTexture } from "../core/noiseTexture";
import { useSceneSignals } from "../core/sceneSignals";
import { halfWidthAt, nearestVisibleDistance, type ViewFrame } from "../core/viewVolume";
import {
  CLOUD_TIMELAPSE,
  DECK_FAR,
  DECK_Y,
  effectiveVisibilityM,
  fogDensityFor,
  METRES_PER_UNIT,
} from "../core/worldFrame";
import { CLOUD_DECK_FRAG, CLOUD_DECK_VERT } from "../shaders/cloudDeck.glsl";
import { RENDER_ORDER } from "../core/constants";
import { deckDrift } from "./clouds/cloudDrift";

interface CloudDeckProps {
  params: SceneParams;
  frame: ViewFrame;
}

const DAY_LIT = new Color("#f4f6f9");
const NIGHT_LIT = new Color("#2b3244");
const SHADE_TINT = new Color("#7d8796");
const STORM = new Color("#3c4049");

/** The trapezoid the frustum cuts out of the plane y = DECK_Y. */
function deckFootprint(frame: ViewFrame) {
  const dNear = Math.max(1, nearestVisibleDistance(frame, DECK_Y) * 0.9);
  const dFar = DECK_FAR;
  return {
    y: DECK_Y,
    dNear,
    dFar,
    hwNear: halfWidthAt(frame, dNear, DECK_Y) * 1.05,
    hwFar: halfWidthAt(frame, dFar, DECK_Y) * 1.05,
  };
}

/**
 * "potato"-tier fallback for <VolumetricClouds>: stratus / stratocumulus /
 * cirrus on one world-space plane, sized to exactly what the camera can see
 * of it. Hidden when there's nothing to draw.
 */
export function CloudDeck({ params, frame }: CloudDeckProps) {
  const s = useSceneSignals();
  const ref = useRef<Mesh>(null);

  const geometry = useMemo(() => {
    const f = deckFootprint(frame);
    // prettier-ignore
    const pos = new Float32Array([
      -f.hwNear, f.y, -f.dNear,
       f.hwNear, f.y, -f.dNear,
       f.hwFar,  f.y, -f.dFar,
      -f.hwFar,  f.y, -f.dFar,
    ]);
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(pos, 3));
    // Front face looks down at the camera.
    geom.setIndex([0, 2, 1, 0, 3, 2]);
    return geom;
  }, [frame]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uNoise: { value: getCloudNoiseTexture() },
          uDrift: { value: new Vector2() },
          uDriftHigh: { value: new Vector2() },
          uWindDir: { value: new Vector2(1, 0) },
          uLow: { value: 0 },
          uHigh: { value: 0 },
          uLit: { value: new Color() },
          uShade: { value: new Color() },
          uHighColor: { value: new Color() },
          uFadeFar: { value: DECK_FAR },
          uFlash: { value: 0 },
          uFogColor: { value: new Color() },
          uFogDensity: { value: 0 },
        },
        vertexShader: CLOUD_DECK_VERT,
        fragmentShader: CLOUD_DECK_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const { clouds, precip, thunder } = params;
  const storm = thunder ? 1 : Math.min(0.6, precip.rainMmH / 12 + precip.snowCmH / 6);
  const fogDensity = fogDensityFor(effectiveVisibilityM(params.fog.visibilityM, params.temperatureC));

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const deck = deckCover(clouds);
    mesh.visible = deck > 0.01 || clouds.high > 0.02;
    if (!mesh.visible) return;
    const u = material.uniforms;
    // Same winds aloft and time-lapse as the volumetric clouds, in scene units.
    const k = CLOUD_TIMELAPSE / METRES_PER_UNIT;
    const wl = Math.hypot(s.windVelocityHigh.x, s.windVelocityHigh.z) || 1;
    const highDir = (u.uWindDir.value as Vector2).set(s.windVelocityHigh.x / wl, s.windVelocityHigh.z / wl);
    deckDrift(
      s.windOffsetLow.x * k,
      s.windOffsetLow.z * k,
      s.windOffsetHigh.x * k,
      s.windOffsetHigh.z * k,
      highDir,
      u.uDrift.value as Vector2,
      u.uDriftHigh.value as Vector2,
    );
    u.uLow.value = deck;
    u.uHigh.value = clouds.high;
    u.uFlash.value = s.flash;
    // Mixed after the sRGB conversion, so the colour is sRGB too (as three does for scene fog).
    s.horizonColor.getRGB(u.uFogColor.value as Color, SRGBColorSpace);
    u.uFogDensity.value = fogDensity;

    const lit = u.uLit.value as Color;
    lit.copy(NIGHT_LIT).lerp(DAY_LIT, s.day);
    lit.lerp(s.sunColor, s.warmth * 0.55 * (1 - s.overcast));
    lit.lerp(STORM, storm * 0.75);
    (u.uShade.value as Color).copy(lit).multiply(SHADE_TINT).lerp(STORM, storm * 0.5);
    (u.uHighColor.value as Color).copy(lit).lerp(s.sunColor, s.warmth * 0.4);
  });

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      renderOrder={RENDER_ORDER.clouds}
      frustumCulled={false}
    />
  );
}
