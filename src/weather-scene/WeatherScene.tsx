import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor, Stats } from "@react-three/drei";
import type { QualityTier, SceneParams } from "../weather/sceneParams";
import { CameraRig, LOOK_TARGET } from "./core/CameraRig";
import { FreeCameraWASD } from "./core/FreeCameraWASD";
import { FrameRateGate } from "./core/FrameRateGate";
import { useIsMobile } from "./core/useIsMobile";
import { initialTier, lowerTier, QUALITY, type QualityBudget } from "./core/quality";
import { createSceneSignals, SceneSignalsProvider } from "./core/sceneSignals";
import { SceneDriver } from "./core/SceneDriver";
import { createViewFrame } from "./core/viewVolume";
import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR } from "./core/worldFrame";
import { SkyLayer } from "./layers/SkyLayer";
import { SkyGrade } from "./layers/SkyGrade";
import { StarField } from "./layers/StarField";
import { Moon } from "./layers/Moon";
import { Lighting } from "./layers/Lighting";
import { FogLayer } from "./layers/FogLayer";
import { CloudDeck } from "./layers/CloudDeck";
import { Cumulus } from "./layers/Cumulus";
import { Precipitation } from "./layers/precip/Precipitation";
import { PerfProbe } from "./debug/PerfProbe";
import { perfStats } from "./debug/perfStats";

export interface WeatherSceneDebugProps {
  freeCamera?: boolean;
  /** Wireframes of every spawn volume — pair with the free camera. */
  showVolumes?: boolean;
  /** fps graph + renderer.info probe. */
  showPerf?: boolean;
  /** Increment to force a lightning strike. */
  lightningNonce?: number;
}

interface WeatherSceneProps extends WeatherSceneDebugProps {
  params: SceneParams;
  className?: string;
  style?: React.CSSProperties;
}

interface SceneRootProps extends WeatherSceneDebugProps {
  params: SceneParams;
  budget: QualityBudget;
}

/**
 * Mount order is load-bearing: R3F runs useFrame callbacks in subscription
 * order, so the camera moves first, then SceneDriver computes this frame's
 * signals, then every layer reads them.
 */
function SceneRoot({
  params,
  budget,
  freeCamera,
  showPerf,
}: SceneRootProps) {
  const signals = useMemo(createSceneSignals, []);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const frame = useMemo(
    () => createViewFrame(aspect, params.parallaxAmount),
    [aspect, params.parallaxAmount],
  );

  return (
    <SceneSignalsProvider value={signals}>
      <FrameRateGate fps={budget.fps} />
      {freeCamera ? (
        <>
          <OrbitControls target={LOOK_TARGET} />
          <FreeCameraWASD />
        </>
      ) : (
        <CameraRig parallaxAmount={params.parallaxAmount} />
      )}
      <SceneDriver params={params} frame={frame} />
      <FogLayer />
      <Lighting />

      <SkyLayer />
      <SkyGrade />
      <StarField frame={frame} count={budget.stars} />
      <Suspense fallback={null}>
        <Moon />
      </Suspense>
      <CloudDeck params={params} frame={frame} />
      <Suspense fallback={null}>
        <Cumulus params={params} frame={frame} budget={budget} />
      </Suspense>
      <Precipitation params={params} frame={frame} budget={budget} />

      {showPerf && (
        <>
          <PerfProbe />
          <Stats className="debug-stats debug-stats--fps" showPanel={0} />
          <Stats className="debug-stats debug-stats--ms" showPanel={1} />
          <Stats className="debug-stats debug-stats--mb" showPanel={2} />
        </>
      )}
    </SceneSignalsProvider>
  );
}

export function WeatherScene({
  params,
  className,
  style,
  freeCamera = false,
  ...debug
}: WeatherSceneProps) {
  const eventSource =
    typeof document !== "undefined"
      ? (document.body as HTMLElement)
      : undefined;
  const isMobile = useIsMobile();
  const [autoTier, setAutoTier] = useState<QualityTier>(() =>
    initialTier(isMobile),
  );
  const tier = params.quality ?? autoTier;
  const budget = QUALITY[tier];
  useEffect(() => {
    perfStats.tier = tier;
  }, [tier]);

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
        camera={{
          position: [0, 0, 0],
          fov: CAMERA_FOV,
          near: CAMERA_NEAR,
          far: CAMERA_FAR,
        }}
        dpr={[1, budget.dprMax]}
        gl={{ alpha: false, antialias: !isMobile }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 0.5;
        }}
        eventSource={eventSource}
        eventPrefix="client"
        style={{ display: "block" }}
      >
        <PerformanceMonitor
          bounds={() => [budget.fps * 0.75, 10_000]}
          flipflops={3}
          onDecline={() => setAutoTier(lowerTier)}
        />
        <SceneRoot
          params={params}
          budget={budget}
          freeCamera={freeCamera}
          {...debug}
        />
      </Canvas>
    </div>
  );
}
