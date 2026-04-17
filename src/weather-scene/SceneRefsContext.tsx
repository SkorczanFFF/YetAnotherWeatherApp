import type { RefObject } from "react";
import { createContext, useRef, useContext } from "react";
import * as THREE from "three";

export interface SceneRefsContextValue {
  cloudGroupRef: RefObject<THREE.Group | null>;
  sunMeshRef: RefObject<THREE.Mesh | null>;
  moonMeshRef: RefObject<THREE.Mesh | null>;
  sunWorldPosRef: RefObject<THREE.Vector3>;
  moonWorldPosRef: RefObject<THREE.Vector3>;
}

const SceneRefsContext = createContext<SceneRefsContextValue | null>(null);

export function useSceneRefs(): SceneRefsContextValue | null {
  return useContext(SceneRefsContext);
}

export function useSceneRefsRequired(): SceneRefsContextValue {
  const ctx = useContext(SceneRefsContext);
  if (!ctx) throw new Error("useSceneRefsRequired must be used within SceneRefsProvider");
  return ctx;
}

export function SceneRefsProvider({ children }: { children: React.ReactNode }) {
  const cloudGroupRef = useRef<THREE.Group | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const sunWorldPosRef = useRef(new THREE.Vector3());
  const moonWorldPosRef = useRef(new THREE.Vector3());
  const value: SceneRefsContextValue = {
    cloudGroupRef,
    sunMeshRef,
    moonMeshRef,
    sunWorldPosRef,
    moonWorldPosRef,
  };
  return (
    <SceneRefsContext.Provider value={value}>
      {children}
    </SceneRefsContext.Provider>
  );
}
