import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor, Stats } from "@react-three/drei";
import type { QualityTier, SceneParams } from "../weather/sceneParams";
import { CameraRig } from "./core/CameraRig";
import { FrameRateGate } from "./core/FrameRateGate";
import { useIsMobile } from "./core/useIsMobile";
import { initialTier, lowerTier, QUALITY, type QualityBudget } from "./core/quality";
import { createSceneSignals, SceneSignalsProvider } from "./core/sceneSignals";
import { SceneDriver } from "./core/SceneDriver";
import { UiBacklight } from "./core/UiBacklight";
import { createViewFrame } from "./core/viewVolume";
import { useCoverColumn } from "./core/useCoverColumn";
import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR } from "./core/worldFrame";
import { SkyLayer } from "./layers/SkyLayer";
import { SkyGrade } from "./layers/SkyGrade";
import { SunGlow } from "./layers/SunGlow";
import { StarField } from "./layers/StarField";
import { Moon } from "./layers/Moon";
import { CloudDeck } from "./layers/CloudDeck";
import { VolumetricClouds } from "./layers/clouds/VolumetricClouds";
import { Precipitation } from "./layers/precip/Precipitation";
import { Thunder } from "./layers/Thunder";
import { DiamondDust } from "./layers/DiamondDust";
import { FrostGlass } from "./layers/FrostGlass";
import { PerfProbe } from "./debug/PerfProbe";
import { perfStats } from "./debug/perfStats";
import { TONE_EXPOSURE } from "./core/constants";

export interface WeatherSceneDebugProps {
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
  isMobile: boolean;
}

/**
 * Mount order is load-bearing: R3F runs useFrame callbacks in subscription
 * order, so the camera moves first, then SceneDriver computes this frame's
 * signals, then every layer reads them.
 */
function SceneRoot({
  params,
  budget,
  isMobile,
  showPerf,
  lightningNonce,
}: SceneRootProps) {
  const signals = useMemo(createSceneSignals, []);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const coverHalf = useCoverColumn(size.width);
  const frame = useMemo(
    () => createViewFrame(aspect, params.parallaxAmount, coverHalf),
    [aspect, params.parallaxAmount, coverHalf],
  );

  return (
    <SceneSignalsProvider value={signals}>
      <FrameRateGate fps={budget.fps} />
      <CameraRig parallaxAmount={params.parallaxAmount} />
      <SceneDriver params={params} frame={frame} />
      <UiBacklight thunder={params.thunder} />

      <SkyLayer />
      <SkyGrade />
      <SunGlow />
      <StarField frame={frame} count={budget.stars} />
      <Suspense fallback={null}>
        <Moon />
      </Suspense>
      {budget.volumetric ? (
        <VolumetricClouds params={params} budget={budget.volumetric} />
      ) : (
        <CloudDeck params={params} frame={frame} />
      )}

      <Precipitation params={params} frame={frame} budget={budget} />
      <Thunder
        enabled={params.thunder}
        cloudBaseM={params.cloudPhysics.baseM}
        nonce={lightningNonce ?? 0}
        frame={frame}
        isMobile={isMobile}
      />
      <DiamondDust params={params} frame={frame} count={budget.sparkles} />
      <FrostGlass params={params} />

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
        pointerEvents: "none",
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
          gl.toneMappingExposure = TONE_EXPOSURE;
        }}
        eventSource={eventSource}
        eventPrefix="client"
        style={{ display: "block" }}
      >
        <PerformanceMonitor
          bounds={() => [budget.fps * 0.75, 10_000]}
          flipflops={3}
          onDecline={() => {
            // A pinned tier's fps says nothing about the auto one.
            if (!params.quality) setAutoTier(lowerTier);
          }}
        />
        <SceneRoot
          params={params}
          budget={budget}
          isMobile={isMobile}
          {...debug}
        />
      </Canvas>
    </div>
  );
}
