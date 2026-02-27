import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimulationConfig } from "../types";

const FOG_COLOR = 0x9a9ca0;

interface FogEffectProps {
  config: SimulationConfig;
}

export function FogEffect({ config }: FogEffectProps) {
  const fogRef = useRef<THREE.FogExp2 | null>(null);

  useFrame((state) => {
    const scene = state.scene;
    const density = config.fogDensity ?? 0;
    if (density > 0) {
      if (!fogRef.current) {
        fogRef.current = new THREE.FogExp2(
          new THREE.Color(FOG_COLOR),
          density,
        );
      }
      fogRef.current.density = density;
      fogRef.current.color.setHex(FOG_COLOR);
      scene.fog = fogRef.current;
    } else {
      scene.fog = null;
    }
  });

  return null;
}
