import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Material, MeshBasicMaterial, NormalBlending, type Texture } from "three";
import {
  BatchedRenderer,
  ConstantColor,
  ConstantValue,
  IntervalValue,
  Noise,
  ParticleSystem,
  RenderMode,
  Vector4,
} from "three.quarks";
import type { SceneParams } from "../../../weather/sceneParams";
import type { QualityBudget } from "../../core/quality";
import { useSceneSignals } from "../../core/sceneSignals";
import type { PrecipVolume, ViewFrame } from "../../core/viewVolume";
import { getDotTexture, getSnowAtlas, SNOW_TILES } from "./textures";
import { ViewVolumeEmitter } from "./ViewVolumeEmitter";

interface PrecipitationProps {
  params: SceneParams;
  frame: ViewFrame;
  budget: QualityBudget;
}

/** Everything about one particle system that, when changed, requires rebuilding it. */
interface SystemSpec {
  key: string;
  /** Simultaneous particles at full intensity. */
  max: number;
  /** 0..1 — scales emission without rebuilding. */
  intensity: number;
  fallMin: number;
  fallMax: number;
  windFactor: number;
  sizeMin: number;
  sizeMax: number;
  mode: RenderMode;
  texture: Texture;
  color: [number, number, number, number];
  volume: PrecipVolume;
  tiles?: number;
  /** Sway amplitude (scene units) for snow. */
  sway?: number;
  /** Stretched billboards: streak length = |velocity| × stretch × size. */
  stretch?: number;
}

const RAIN_VOLUME: PrecipVolume = { dNear: 1.5, dFar: 40, pad: 1.5 };
const SNOW_VOLUME: PrecipVolume = { dNear: 1.5, dFar: 30, pad: 1 };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function buildSpecs(params: SceneParams, budget: QualityBudget): SystemSpec[] {
  const { precip, wind } = params;
  const specs: SystemSpec[] = [];
  const sleet = precip.rainMmH > 0 && precip.snowCmH > 0;

  if (precip.rainMmH > 0) {
    const r = precip.rainMmH;
    const color: SystemSpec["color"] = precip.freezing
      ? [0.92, 0.96, 1.0, 0.6]
      : [0.84, 0.89, 0.96, precip.drizzle ? 0.4 : 0.5];
    specs.push(
      precip.drizzle
        ? {
            key: "drizzle",
            max: budget.rain,
            intensity: clamp01(0.35 + (r / 1.5) * 0.65) * (sleet ? 0.6 : 1),
            fallMin: 6.5,
            fallMax: 9,
            windFactor: 0.9,
            sizeMin: 0.016,
            sizeMax: 0.024,
            stretch: 0.9,
            mode: RenderMode.StretchedBillBoard,
            texture: getDotTexture(),
            color,
            volume: RAIN_VOLUME,
          }
        : {
            key: "rain",
            max: budget.rain,
            intensity: clamp01(Math.pow(r / 10, 0.6) + 0.06) * (sleet ? 0.6 : 1),
            fallMin: 14 + Math.min(r, 20) * 0.2,
            fallMax: 20 + Math.min(r, 20) * 0.25,
            windFactor: 0.7,
            sizeMin: 0.03,
            sizeMax: 0.045,
            stretch: 1.1,
            mode: RenderMode.StretchedBillBoard,
            texture: getDotTexture(),
            color,
            volume: RAIN_VOLUME,
          },
    );
  }

  if (precip.snowCmH > 0) {
    const s = precip.snowCmH;
    const intensity = clamp01(Math.pow(s / 3, 0.6) + 0.06);
    specs.push(
      precip.grains
        ? {
            key: "grains",
            max: budget.snow,
            intensity,
            fallMin: 3.5,
            fallMax: 5,
            windFactor: 0.5,
            sizeMin: 0.05,
            sizeMax: 0.08,
            mode: RenderMode.BillBoard,
            texture: getDotTexture(),
            color: [0.94, 0.96, 1, 0.85],
            volume: SNOW_VOLUME,
          }
        : {
            key: sleet ? "wet-snow" : "snow",
            max: budget.snow,
            intensity: sleet ? intensity * 0.7 : intensity,
            // Wet flakes fall faster.
            fallMin: sleet ? 2.6 : 1.1,
            fallMax: sleet ? 3.6 : 2.0,
            windFactor: 0.55,
            sizeMin: sleet ? 0.12 : 0.16,
            sizeMax: sleet ? 0.2 : 0.3,
            mode: RenderMode.BillBoard,
            texture: getSnowAtlas(),
            color: [1, 1, 1, 0.95],
            volume: SNOW_VOLUME,
            tiles: SNOW_TILES,
            sway: 0.3 + Math.min(wind.speedMs, 20) * 0.03,
          },
    );
  }

  if (precip.hail) {
    specs.push({
      key: "hail",
      max: budget.hail,
      intensity: 0.6,
      fallMin: 22,
      fallMax: 28,
      windFactor: 0.4,
      sizeMin: 0.07,
      sizeMax: 0.12,
      // Short streaks — hail is fast enough to blur.
      stretch: 0.3,
      mode: RenderMode.StretchedBillBoard,
      texture: getDotTexture(),
      color: [0.97, 0.98, 1, 1],
      volume: SNOW_VOLUME,
    });
  }
  return specs;
}

/** Initial guess for the mean particle life (calm air) — the emitter refines it as it spawns. */
function initialMeanLife(frame: ViewFrame, spec: SystemSpec): number {
  const { dNear, dFar, pad } = spec.volume;
  // Mean distance of points uniform in the trapezoid (density ∝ d).
  const dMean = ((2 / 3) * (dFar ** 3 - dNear ** 3)) / (dFar ** 2 - dNear ** 2);
  const span = (frame.tanTop - frame.tanBottom) * dMean + 2 * pad;
  return span / ((spec.fallMin + spec.fallMax) / 2);
}

interface LiveSystem {
  system: ParticleSystem;
  emitter: ViewVolumeEmitter;
  rate: ConstantValue;
  material: MeshBasicMaterial;
}

/**
 * Rain, drizzle, snow, snow grains, sleet and hail on three.quarks. One
 * BatchedRenderer; each kind is a ParticleSystem with a ViewVolumeEmitter, so
 * particles exist only inside the frame. Intensity changes only retune the
 * emission rate; a system is rebuilt only when its structure changes.
 * Showers pulse the rate.
 */
export function Precipitation({ params, frame, budget }: PrecipitationProps) {
  const s = useSceneSignals();
  const renderer = useMemo(() => new BatchedRenderer(), []);
  const specs = useMemo(() => buildSpecs(params, budget), [params, budget]);
  const live = useRef(new Map<string, LiveSystem>());
  const specsRef = useRef(specs);
  specsRef.current = specs;

  // Rebuild only on structural change; the key ignores intensity.
  const structure = specs
    .map((sp) => `${sp.key}:${sp.max}:${sp.fallMin.toFixed(1)}:${sp.fallMax.toFixed(1)}:${sp.color.join(",")}:${sp.sway ?? 0}`)
    .join("|");

  useEffect(() => {
    const created: LiveSystem[] = [];
    for (const spec of specsRef.current) {
      const material = new MeshBasicMaterial({
        map: spec.texture,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        toneMapped: false,
        // Near-field particles: fogging them only greys them out.
        fog: false,
      });
      const rate = new ConstantValue(0);
      const behaviors = spec.sway
        ? [new Noise(new ConstantValue(0.5), new ConstantValue(spec.sway), new ConstantValue(1))]
        : [];
      const emitter = new ViewVolumeEmitter(
        {
          frame,
          volume: spec.volume,
          fallMin: spec.fallMin,
          fallMax: spec.fallMax,
          wind: s.windVelocity,
          windFactor: spec.windFactor,
          tiles: spec.tiles,
        },
        initialMeanLife(frame, spec),
      );
      const system = new ParticleSystem({
        looping: true,
        duration: 10,
        prewarm: true,
        worldSpace: true,
        shape: emitter,
        startLife: new ConstantValue(1), // overridden per particle by the emitter
        startSpeed: new ConstantValue(0),
        startSize: new IntervalValue(spec.sizeMin, spec.sizeMax),
        startRotation: new IntervalValue(0, Math.PI * 2),
        startColor: new ConstantColor(new Vector4(...spec.color)),
        emissionOverTime: rate,
        behaviors,
        material,
        renderMode: spec.mode,
        rendererEmitterSettings:
          spec.mode === RenderMode.StretchedBillBoard
            ? { speedFactor: spec.stretch ?? 1, lengthFactor: 0 }
            : {},
        uTileCount: spec.tiles ?? 1,
        vTileCount: 1,
        renderOrder: 4,
      });
      const entry: LiveSystem = { system, emitter, rate, material };
      rate.value = (spec.max * spec.intensity) / emitter.meanLife;
      renderer.addSystem(system);
      renderer.add(system.emitter);
      live.current.set(spec.key, entry);
      created.push(entry);
    }
    return () => {
      for (const entry of created) {
        entry.system.dispose();
        entry.material.dispose();
      }
      live.current.clear();
    };
    // `structure` captures everything spec-related that needs a rebuild.
  }, [structure, frame, renderer, s]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pulse = params.precip.showers
      ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1.3))
      : 1;
    for (const spec of specsRef.current) {
      const entry = live.current.get(spec.key);
      if (entry) {
        entry.rate.value = (spec.max * spec.intensity * pulse) / Math.max(0.2, entry.emitter.meanLife);
      }
    }
    renderer.update(delta);
    // quarks builds its own ShaderMaterial per batch and drops toneMapped;
    // without this the scene's ACES exposure (0.5, tuned for <Sky>) greys particles out.
    for (const batch of renderer.batches) {
      const m = batch.material as Material;
      if (m.toneMapped) {
        m.toneMapped = false;
        m.needsUpdate = true;
      }
    }
  });

  return <primitive object={renderer} />;
}
