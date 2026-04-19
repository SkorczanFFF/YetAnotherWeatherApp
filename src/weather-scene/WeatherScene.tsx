import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import type { SimulationConfig } from "./types";
import { CameraRig } from "./scene/CameraRig";
import { DebugBox, type DebugBoxPosition } from "./scene/DebugBox";
import { FreeCameraWASD } from "./scene/FreeCameraWASD";
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
      {/* Camera rig is mounted first so its useFrame fires *before* SkyStage's
          children, keeping camera matrix updates ahead of any post-process
          pass that projects with the camera. */}
      {freeCamera ? (
        <>
          <OrbitControls />
          <FreeCameraWASD />
        </>
      ) : (
        <CameraRig parallaxAmount={config.parallaxAmount} />
      )}
      <SkyStage config={config} />
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
      {/* Canonical Canvas config from takram's Clouds-Basic Storybook story:
          gl.depth=false (the AerialPerspective + Clouds passes manage depth
          themselves via the EffectComposer's normalPass), camera near=1
          far=4e5 to give plenty of depth precision for the atmospheric
          scattering shader, no DPR/antialias overrides — defaults are fine
          since MSAA is disabled inside the composer. */}
      <Canvas
        gl={{ depth: false, alpha: true }}
        camera={{ position: [0, 0, 5], fov: 75, near: 1, far: 4e5 }}
        eventSource={eventSource}
        eventPrefix="client"
        style={{ display: "block" }}
      >
        <SceneContent
          config={config}
          showDebugBox={showDebugBox}
          debugBoxPosition={debugBoxPosition}
          freeCamera={freeCamera}
        />
      </Canvas>
    </div>
  );
}
