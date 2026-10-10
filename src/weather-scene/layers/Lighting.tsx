import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { DirectionalLight, HemisphereLight, PointLight } from "three";
import { useSceneSignals } from "../core/sceneSignals";

const MOON_COLOR = "#9db4d8";

/**
 * Lights for the lit layers (drei <Clouds> use MeshLambertMaterial): sun and
 * moon key lights from their DISPLAYED directions, a hemisphere fill, and a
 * point light parked at the current lightning bolt. All lights always exist —
 * toggling lights would recompile every lit material.
 */
export function Lighting() {
  const s = useSceneSignals();
  const sun = useRef<DirectionalLight>(null);
  const moon = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const bolt = useRef<PointLight>(null);

  useFrame(() => {
    if (sun.current) {
      sun.current.position.copy(s.sunDir).multiplyScalar(100);
      sun.current.color.copy(s.sunColor);
      sun.current.intensity = s.sunIntensity;
    }
    if (moon.current) {
      moon.current.position.copy(s.moonDir).multiplyScalar(100);
      moon.current.intensity = s.moonIntensity;
    }
    if (hemi.current) {
      hemi.current.color.copy(s.hemiSky);
      hemi.current.groundColor.copy(s.hemiGround);
      hemi.current.intensity = s.hemiIntensity;
    }
    if (bolt.current) {
      bolt.current.position.copy(s.flashPosition);
      bolt.current.intensity = s.flash * 60000;
    }
  });

  return (
    <>
      <directionalLight ref={sun} />
      <directionalLight ref={moon} color={MOON_COLOR} intensity={0} />
      <hemisphereLight ref={hemi} />
      <pointLight ref={bolt} color="#dfe6ff" intensity={0} decay={2} />
    </>
  );
}
