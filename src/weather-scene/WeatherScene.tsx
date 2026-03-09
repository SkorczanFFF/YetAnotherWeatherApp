import React from "react";
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls, Stats } from "@react-three/drei";
import type { SimulationConfig } from "./types";
import { SceneRefsProvider } from "./SceneRefsContext";
import { SkyBackground } from "./scene/SkyBackground";
import { CameraRig } from "./scene/CameraRig";
import { DebugBox, type DebugBoxPosition } from "./scene/DebugBox";
import { FreeCameraWASD } from "./scene/FreeCameraWASD";
import { FogEffect } from "./effects/FogEffect";
import { RainEffect } from "./effects/RainEffect";
import { SnowEffect } from "./effects/SnowEffect";
import { CloudEffect } from "./effects/CloudEffect";
import { MistEffect } from "./effects/MistEffect";
import { LightningEffect } from "./effects/LightningEffect";
import { CelestialBodies } from "./effects/CelestialBodies";

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
  const ambientIntensity = 1;

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <SkyBackground config={config} />
      <CelestialBodies config={config} />
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
      <CloudEffect config={config} />
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
    typeof document !== "undefined" ? (document.body as HTMLElement) : undefined;

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
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ alpha: true, antialias: true }}
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
