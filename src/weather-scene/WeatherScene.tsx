import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls, Stats } from "@react-three/drei";
import { NoToneMapping } from "three";
import type { SimulationConfig } from "./types";
import { SceneRefsProvider } from "./SceneRefsContext";
import { CameraRig } from "./scene/CameraRig";
import { DebugBox, type DebugBoxPosition } from "./scene/DebugBox";
import { FreeCameraWASD } from "./scene/FreeCameraWASD";
import {
  detectQualityTier,
  getRuntimePreset,
} from "./effects/internal/qualityPreset";
import {
  SkyStage,
  FogEffect,
  RainEffect,
  SnowEffect,
  MistEffect,
  LightningEffect,
} from "./effects";

export type { DebugBoxPosition } from "./scene/DebugBox";

interface WeatherSceneProps {
  config: SimulationConfig;
  className?: string;
  style?: React.CSSProperties;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
  freeCamera?: boolean;
}

function SceneContent({
  config,
  showDebugBox,
  debugBoxPosition,
  freeCamera,
}: {
  config: SimulationConfig;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
  freeCamera?: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <SkyStage config={config} />
      {config.timeOfDay === "night" && (
        <Stars
          radius={80}
          depth={50}
          count={3000}
          factor={3}
          saturation={2}
          fade
          speed={0.65}
        />
      )}
      {freeCamera ? (
        <>
          <OrbitControls />
          <FreeCameraWASD />
        </>
      ) : (
        <CameraRig parallaxAmount={config.parallaxAmount} />
      )}
      <LightningEffect config={config} />
      <FogEffect config={config} />
      <RainEffect config={config} />
      <SnowEffect config={config} />
      <MistEffect config={config} />
      {showDebugBox && debugBoxPosition && (
        <DebugBox position={debugBoxPosition} />
      )}
      {showDebugBox && (
        <>
          <Stats className="debug-stats debug-stats--fps" showPanel={0} />
          <Stats className="debug-stats debug-stats--ms" showPanel={1} />
          <Stats className="debug-stats debug-stats--mb" showPanel={2} />
        </>
      )}
    </>
  );
}

export function WeatherScene({
  config,
  className,
  style,
  showDebugBox,
  debugBoxPosition,
  freeCamera = false,
}: WeatherSceneProps) {
  const eventSource =
    typeof document !== "undefined"
      ? (document.body as HTMLElement)
      : undefined;
  // Tier the main Canvas identically to the clouds pass. On low tier (mobile
  // or integrated GPU) we clamp DPR to 1 and drop MSAA — rendering at native
  // retina 2× with 4× MSAA is ~8× the fragment work for no perceptible gain
  // over the already-dominant cloud + atmosphere passes.
  const tier = useMemo(() => getRuntimePreset(detectQualityTier()).tier, []);
  const dpr = useMemo<number | [number, number]>(
    () =>
      tier === "low"
        ? 1
        : [1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)],
    [tier],
  );

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: freeCamera ? "auto" : "none",
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75, near: 0.1, far: 1_000_000 }}
        // NoToneMapping on the renderer is required because SkyStage runs a
        // postprocess AGX ToneMapping pass. R3F's default is
        // ACESFilmicToneMapping which would re-compress the already-tonemapped
        // framebuffer, producing the crushed-midtone "dark scene" look.
        gl={{ alpha: true, antialias: tier !== "low", toneMapping: NoToneMapping }}
        dpr={dpr}
        eventSource={eventSource}
        eventPrefix="client"
        style={{ display: "block" }}
      >
        <SceneRefsProvider>
          <SceneContent
            config={config}
            showDebugBox={showDebugBox}
            debugBoxPosition={debugBoxPosition}
            freeCamera={freeCamera}
          />
        </SceneRefsProvider>
      </Canvas>
    </div>
  );
}
