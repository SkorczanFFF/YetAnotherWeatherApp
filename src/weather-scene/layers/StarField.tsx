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

interface StarFieldProps {
  frame: ViewFrame;
  count: number;
}

const RADIUS = 1500;

/**
 * Stars generated ONLY inside the frame's patch of sky (drei <Stars> fills a
 * whole sphere and can't fade). Opacity follows night, cloud cover and haze;
 * the object is hidden outright when they'd be invisible.
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
    for (let i = 0; i < count; i++) {
      const relAz = (Math.random() * 2 - 1) * patch.relAzMax;
      // Area-uniform in elevation.
      const alt = Math.asin(sinMin + Math.random() * (sinMax - sinMin));
      directionFromRelative(relAz, alt, dir).multiplyScalar(RADIUS);
      pos[i * 3] = dir.x;
      pos[i * 3 + 1] = dir.y;
      pos[i * 3 + 2] = dir.z;
      // Many faint, few bright.
      size[i] = 1 + Math.pow(Math.random(), 6) * 3.2;
      phase[i] = Math.random();
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
      renderOrder={0}
      frustumCulled={false}
    />
  );
}
