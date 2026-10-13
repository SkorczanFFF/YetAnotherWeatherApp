import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Points,
  ShaderMaterial,
} from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { skyPatch, type ViewFrame } from "../core/viewVolume";
import { directionFromRelative } from "../core/worldFrame";
import { STARS_FRAG, STARS_VERT } from "../shaders/stars.glsl";
import { RENDER_ORDER } from "../core/constants";

interface StarFieldProps {
  frame: ViewFrame;
  count: number;
}

const RADIUS = 1500;

/** mulberry32: a fixed sequence, so a resize reshapes the patch but keeps each star in place within it. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stars only inside the frame's patch of sky, with continuous opacity — drei <Stars>
 * fills a whole sphere and can't fade.
 */
export function StarField({ frame, count }: StarFieldProps) {
  const s = useSceneSignals();
  const ref = useRef<Points>(null);
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = useMemo(() => {
    const patch = skyPatch(frame);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const sinMin = Math.sin(patch.elevMin);
    const sinMax = Math.sin(patch.elevMax);
    const dir = directionFromRelative(0, 0);
    const random = seededRandom(1);
    for (let i = 0; i < count; i++) {
      const relAz = (random() * 2 - 1) * patch.relAzMax;
      // Area-uniform in elevation.
      const alt = Math.asin(sinMin + random() * (sinMax - sinMin));
      directionFromRelative(relAz, alt, dir).multiplyScalar(RADIUS);
      pos[i * 3] = dir.x;
      pos[i * 3 + 1] = dir.y;
      pos[i * 3 + 2] = dir.z;
      // Many faint, few bright.
      size[i] = 1 + Math.pow(random(), 6) * 3.2;
      phase[i] = random();
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(pos, 3));
    geom.setAttribute("aSize", new BufferAttribute(size, 1));
    geom.setAttribute("aPhase", new BufferAttribute(phase, 1));
    return geom;
  }, [frame, count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uPixelRatio: { value: 1 },
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        },
        vertexShader: STARS_VERT,
        fragmentShader: STARS_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const opacity =
      s.night * (1 - s.overcast) * (1 - s.haze * 0.9) * (1 - s.flash);
    if (ref.current) ref.current.visible = opacity > 0.01;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = dpr;
  });

  return (
    <points
      ref={ref}
      geometry={geometry}
      material={material}
      renderOrder={RENDER_ORDER.stars}
      frustumCulled={false}
    />
  );
}
