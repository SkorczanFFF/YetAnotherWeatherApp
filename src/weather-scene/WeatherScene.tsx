import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
import { FogLayer } from "./layers/FogLayer";
import { CloudDeck } from "./layers/CloudDeck";
import { VolumetricClouds } from "./layers/VolumetricClouds";
import { Precipitation } from "./layers/precip/Precipitation";
import { Thunder } from "./layers/Thunder";
import { DiamondDust } from "./layers/DiamondDust";
import { PerfProbe } from "./debug/PerfProbe";
import { VolumeHelpers } from "./debug/VolumeHelpers";
import { perfStats } from "./debug/perfStats";

export type CloudEngine = "ours" | "takram";

// TEST ONLY: takram clouds + atmosphere, loaded on first use so the regular
// bundle stays free of postprocessing/takram.
const TakramSky = lazy(() =>
  import("./takram/TakramSky").then((m) => ({ default: m.TakramSky })),
);

export interface WeatherSceneDebugProps {
  freeCamera?: boolean;
  /** Wireframes of every spawn volume — pair with the free camera. */
  showVolumes?: boolean;
  /** fps graph + renderer.info probe. */
  showPerf?: boolean;
  /** Increment to force a lightning strike. */
  lightningNonce?: number;
  /** TEST ONLY: which cloud/sky renderer to use. */
  cloudEngine?: CloudEngine;
}

interface WeatherSceneProps extends WeatherSceneDebugProps {
  params: SceneParams;
  className?: string;
  style?: React.CSSProperties;
}

interface SceneRootProps extends WeatherSceneDebugProps {
  params: SceneParams;
  budget: QualityBudget;
  tier: QualityTier;
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
  tier,
  isMobile,
  freeCamera,
  showVolumes,
  showPerf,
  lightningNonce,
  cloudEngine = "ours",
}: SceneRootProps) {
  const signals = useMemo(createSceneSignals, []);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const frame = useMemo(
    () => createViewFrame(aspect, params.parallaxAmount),
    [aspect, params.parallaxAmount],
  );

  // Drawn over the sky/clouds in both engines (takram renders them in its own
  // overlay pass after the composer).
  const overlay = (
    <>
      <Precipitation params={params} frame={frame} budget={budget} />
      <Thunder
        enabled={params.thunder}
        nonce={lightningNonce ?? 0}
        frame={frame}
        isMobile={isMobile}
      />
      <DiamondDust params={params} frame={frame} count={budget.sparkles} />
    </>
  );

  return (
    <SceneSignalsProvider value={signals}>
      <FrameRateGate fps={budget.fps} />
      {freeCamera ? (
        <>
          {/* Stay inside the <Sky> box (half-size 1500) so the debug view keeps its sky. */}
          <OrbitControls target={LOOK_TARGET} maxDistance={600} />
          <FreeCameraWASD />
        </>
      ) : (
        <CameraRig parallaxAmount={params.parallaxAmount} />
      )}
      <SceneDriver params={params} frame={frame} />
      <FogLayer />

      {cloudEngine === "takram" ? (
        <Suspense fallback={null}>
          <TakramSky params={params} tier={tier} overlay={overlay} />
        </Suspense>
      ) : (
        <>
          <SkyLayer />
          <SkyGrade />
          <StarField frame={frame} count={budget.stars} />
          <Suspense fallback={null}>
            <Moon />
          </Suspense>
          {budget.volumetric ? (
            <VolumetricClouds params={params} budget={budget.volumetric} />
          ) : (
            <CloudDeck params={params} frame={frame} />
          )}
          {overlay}
        </>
      )}

      {showVolumes && <VolumeHelpers frame={frame} />}
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
          tier={tier}
          isMobile={isMobile}
          freeCamera={freeCamera}
          {...debug}
        />
      </Canvas>
    </div>
  );
}
