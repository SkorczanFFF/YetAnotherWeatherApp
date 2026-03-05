import type { RefObject } from "react";
import { createContext, useRef, useContext } from "react";
import * as THREE from "three";

export interface SceneRefsContextValue {
  cloudGroupRef: RefObject<THREE.Group | null>;
}

const SceneRefsContext = createContext<SceneRefsContextValue | null>(null);

export function useSceneRefs(): SceneRefsContextValue | null {
  return useContext(SceneRefsContext);
}

export function SceneRefsProvider({ children }: { children: React.ReactNode }) {
  const cloudGroupRef = useRef<THREE.Group | null>(null);
  const value: SceneRefsContextValue = { cloudGroupRef };
  return (
    <SceneRefsContext.Provider value={value}>
      {children}
    </SceneRefsContext.Provider>
  );
}
