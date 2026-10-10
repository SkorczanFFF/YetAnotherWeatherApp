import React, { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import type { ShaderMaterial } from "three";
import type { SimulationConfig } from "./types";
import { CameraRig } from "./scene/CameraRig";
import { DebugBox, type DebugBoxPosition } from "./scene/DebugBox";
import { FreeCameraWASD } from "./scene/FreeCameraWASD";
import { FrameRateGate } from "./scene/FrameRateGate";
import { useIsMobile } from "./scene/useIsMobile";
import { PHASE_PALETTES } from "./scene/phasePalette";
import { SkyDome } from "./effects/SkyDome";
import { Celestial } from "./effects/Celestial";
import { Stars } from "./effects/Stars";
import { CloudLayer } from "./effects/CloudLayer";
import { RainEffect } from "./effects/RainEffect";
import { SnowEffect } from "./effects/SnowEffect";
import { FogEffect } from "./effects/FogEffect";
import { ThunderEffect } from "./effects/ThunderEffect";

export type { DebugBoxPosition } from "./scene/DebugBox";

interface WeatherSceneProps {
  config: SimulationConfig;
  className?: string;
  style?: React.CSSProperties;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
  freeCamera?: boolean;
}

interface SceneContentExtraProps {
  isMobile: boolean;
}

function SceneContent({
  config,
  showDebugBox,
  debugBoxPosition,
  freeCamera,
  isMobile,
}: Omit<WeatherSceneProps, "className" | "style"> & SceneContentExtraProps) {
  const palette = PHASE_PALETTES[config.timeOfDay];
  const skyMaterialRef = useRef<ShaderMaterial | null>(null);

  return (
    <>
      <FrameRateGate fps={60} />

      {freeCamera ? (
        <>
          <OrbitControls />
          <FreeCameraWASD />
        </>
      ) : (
        <CameraRig parallaxAmount={config.parallaxAmount} />
      )}

      <SkyDome config={config} materialRef={skyMaterialRef} />
      <Stars config={config} isMobile={isMobile} />
      <Celestial config={config} />
      <CloudLayer config={config} />
      {(config.effectType === "rain" || config.effectType === "thunderstorm") && (
        <RainEffect config={config} isMobile={isMobile} />
      )}
      {config.effectType === "snow" && (
        <SnowEffect config={config} isMobile={isMobile} />
      )}
      {config.effectType === "fog" && <FogEffect config={config} />}
      {config.effectType === "thunderstorm" && (
        <ThunderEffect
          config={config}
          skyMaterialRef={skyMaterialRef}
          isMobile={isMobile}
        />
      )}

      <ambientLight
        color={palette.ambient}
        intensity={palette.ambientIntensity}
      />
      <directionalLight
        color={palette.dirColor}
        intensity={palette.dirIntensity}
        position={palette.dirPos}
      />

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
  const isMobile = useIsMobile();

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
        frameloop="demand"
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, isMobile ? 1 : 1.5]}
        gl={{ alpha: false, antialias: !isMobile }}
        eventSource={eventSource}
        eventPrefix="client"
        style={{ display: "block" }}
      >
        <SceneContent
          config={config}
          showDebugBox={showDebugBox}
          debugBoxPosition={debugBoxPosition}
          freeCamera={freeCamera}
          isMobile={isMobile}
        />
      </Canvas>
    </div>
  );
}
