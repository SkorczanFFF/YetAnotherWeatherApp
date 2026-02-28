import React from "react";
import { Canvas } from "@react-three/fiber";
import type { SimulationConfig } from "../weather-simulation/types";
import { SkyBackground } from "./scene/SkyBackground";
import { CameraRig } from "./scene/CameraRig";
import { DebugBox, type DebugBoxPosition } from "./scene/DebugBox";
import { FogEffect } from "./effects/FogEffect";
import { RainEffect } from "./effects/RainEffect";
import { SnowEffect } from "./effects/SnowEffect";
import { CloudEffect } from "./effects/CloudEffect";
import { MistEffect } from "./effects/MistEffect";
import { LightningEffect } from "./effects/LightningEffect";

export type { DebugBoxPosition } from "./scene/DebugBox";

interface WeatherSceneProps {
  config: SimulationConfig;
  className?: string;
  style?: React.CSSProperties;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
}

function SceneContent({
  config,
  showDebugBox,
  debugBoxPosition,
}: {
  config: SimulationConfig;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
}) {
  return (
    <>
      <SkyBackground config={config} />
      <CameraRig parallaxAmount={config.parallaxAmount} />
      <LightningEffect config={config} />
      <FogEffect config={config} />
      <RainEffect config={config} />
      <SnowEffect config={config} />
      <CloudEffect config={config} />
      <MistEffect config={config} />
      {showDebugBox && debugBoxPosition && (
        <DebugBox position={debugBoxPosition} />
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
        pointerEvents: "none",
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
        <SceneContent
          config={config}
          showDebugBox={showDebugBox}
          debugBoxPosition={debugBoxPosition}
        />
      </Canvas>
    </div>
  );
}
