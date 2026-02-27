import React from "react";
import { Canvas } from "@react-three/fiber";
import type { SimulationConfig } from "./types";
import { SkyBackground } from "./scene/SkyBackground";
import { CameraRig } from "./scene/CameraRig";
import { FogEffect } from "./effects/FogEffect";
import { RainEffect } from "./effects/RainEffect";
import { SnowEffect } from "./effects/SnowEffect";
import { CloudEffect } from "./effects/CloudEffect";
import { MistEffect } from "./effects/MistEffect";

interface WeatherSceneR3FProps {
  config: SimulationConfig;
  className?: string;
  style?: React.CSSProperties;
}

function SceneContent({ config }: { config: SimulationConfig }) {
  return (
    <>
      <SkyBackground config={config} />
      <CameraRig parallaxAmount={config.parallaxAmount} />
      <FogEffect config={config} />
      <RainEffect config={config} />
      <SnowEffect config={config} />
      <CloudEffect config={config} />
      <MistEffect config={config} />
    </>
  );
}

export function WeatherSceneR3F({
  config,
  className,
  style,
}: WeatherSceneR3FProps) {
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
        <SceneContent config={config} />
      </Canvas>
    </div>
  );
}
