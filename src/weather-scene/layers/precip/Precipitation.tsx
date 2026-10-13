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
import { clamp01 } from "../../../utils/math";
import type { QualityBudget } from "../../core/quality";
import { useSceneSignals } from "../../core/sceneSignals";
import type { PrecipVolume, ViewFrame } from "../../core/viewVolume";
import { getDotTexture, getSnowAtlas, SNOW_TILES } from "./textures";
import { ViewVolumeEmitter } from "./ViewVolumeEmitter";
import { RENDER_ORDER } from "../../core/constants";

interface PrecipitationProps {
  params: SceneParams;
  frame: ViewFrame;
  budget: QualityBudget;
}

type Kind = "drizzle" | "rain" | "grains" | "snow" | "wet-snow" | "hail";

/** What a particle system is built from — fixed per kind. */
interface KindDef {
  mode: RenderMode;
  texture: () => Texture;
  volume: PrecipVolume;
  windFactor: number;
  sizeMin: number;
  sizeMax: number;
  /** Fall speed range, scene units/s (rain raises it with the rate). */
  fall: [number, number];
  /** Stretched billboards: streak length = |velocity| × stretch × size. */
  stretch?: number;
  tiles?: number;
}

const RAIN_VOLUME: PrecipVolume = { dNear: 1.5, dFar: 40, pad: 1.5 };
const SNOW_VOLUME: PrecipVolume = { dNear: 1.5, dFar: 30, pad: 1 };

const KINDS: Record<Kind, KindDef> = {
  drizzle: {
    mode: RenderMode.StretchedBillBoard, texture: getDotTexture, volume: RAIN_VOLUME,
    windFactor: 0.9, sizeMin: 0.016, sizeMax: 0.024, fall: [6.5, 9], stretch: 0.9,
  },
  rain: {
    mode: RenderMode.StretchedBillBoard, texture: getDotTexture, volume: RAIN_VOLUME,
    windFactor: 0.7, sizeMin: 0.03, sizeMax: 0.045, fall: [14, 20], stretch: 1.1,
  },
  grains: {
    mode: RenderMode.BillBoard, texture: getDotTexture, volume: SNOW_VOLUME,
    windFactor: 0.5, sizeMin: 0.05, sizeMax: 0.08, fall: [3.5, 5],
  },
  snow: {
    mode: RenderMode.BillBoard, texture: getSnowAtlas, volume: SNOW_VOLUME,
    windFactor: 0.55, sizeMin: 0.16, sizeMax: 0.3, fall: [1.1, 2], tiles: SNOW_TILES,
  },
  // Wet flakes: smaller and faster.
  "wet-snow": {
    mode: RenderMode.BillBoard, texture: getSnowAtlas, volume: SNOW_VOLUME,
    windFactor: 0.55, sizeMin: 0.12, sizeMax: 0.2, fall: [2.6, 3.6], tiles: SNOW_TILES,
  },
  // Short streaks — hail is fast enough to blur.
  hail: {
    mode: RenderMode.StretchedBillBoard, texture: getDotTexture, volume: SNOW_VOLUME,
    windFactor: 0.4, sizeMin: 0.07, sizeMax: 0.12, fall: [22, 28], stretch: 0.3,
  },
};

/** What changes with the weather — applied to the live system every frame. */
interface SystemSpec {
  kind: Kind;
  /** Simultaneous particles at full intensity. */
  max: number;
  /** 0..1 — scales emission. */
  intensity: number;
  fallMin: number;
  fallMax: number;
  color: [number, number, number, number];
  /** Sway amplitude (scene units) for snow. */
  sway?: number;
}

function buildSpecs(params: SceneParams, budget: QualityBudget): SystemSpec[] {
  const { precip, wind } = params;
  const specs: SystemSpec[] = [];
  const sleet = precip.rainMmH > 0 && precip.snowCmH > 0;
  const fall = (kind: Kind) => ({ fallMin: KINDS[kind].fall[0], fallMax: KINDS[kind].fall[1] });

  if (precip.rainMmH > 0) {
    const r = precip.rainMmH;
    const color: SystemSpec["color"] = precip.freezing
      ? [0.92, 0.96, 1.0, 0.6]
      : [0.84, 0.89, 0.96, precip.drizzle ? 0.4 : 0.5];
    specs.push(
      precip.drizzle
        ? {
            kind: "drizzle",
            max: budget.rain,
            intensity: clamp01(0.35 + (r / 1.5) * 0.65) * (sleet ? 0.6 : 1),
            ...fall("drizzle"),
            color,
          }
        : {
            kind: "rain",
            max: budget.rain,
            intensity: clamp01(Math.pow(r / 10, 0.6) + 0.06) * (sleet ? 0.6 : 1),
            // Heavier rain, bigger and faster drops.
            fallMin: KINDS.rain.fall[0] + Math.min(r, 20) * 0.2,
            fallMax: KINDS.rain.fall[1] + Math.min(r, 20) * 0.25,
            color,
          },
    );
  }

  if (precip.snowCmH > 0) {
    const intensity = clamp01(Math.pow(precip.snowCmH / 3, 0.6) + 0.06);
    if (precip.grains) {
      specs.push({ kind: "grains", max: budget.snow, intensity, ...fall("grains"), color: [0.94, 0.96, 1, 0.85] });
    } else {
      const kind = sleet ? "wet-snow" : "snow";
      specs.push({
        kind,
        max: budget.snow,
        intensity: sleet ? intensity * 0.7 : intensity,
        ...fall(kind),
        color: [1, 1, 1, 0.95],
        sway: 0.3 + Math.min(wind.speedMs, 20) * 0.03,
      });
    }
  }

  if (precip.hail) {
    specs.push({ kind: "hail", max: budget.hail, intensity: 0.6, ...fall("hail"), color: [0.97, 0.98, 1, 1] });
  }
  return specs;
}

/** Initial guess for the mean particle life (calm air) — the emitter refines it as it spawns. */
function initialMeanLife(frame: ViewFrame, spec: SystemSpec): number {
  const { dNear, dFar, pad } = KINDS[spec.kind].volume;
  // Mean distance of points uniform in the trapezoid (density ∝ d).
  const dMean = ((2 / 3) * (dFar ** 3 - dNear ** 3)) / (dFar ** 2 - dNear ** 2);
  const span = (frame.tanTop - frame.tanBottom) * dMean + 2 * pad;
  return span / ((spec.fallMin + spec.fallMax) / 2);
}

interface LiveSystem {
  system: ParticleSystem;
  emitter: ViewVolumeEmitter;
  rate: ConstantValue;
  color: Vector4;
  sway: ConstantValue | null;
  material: MeshBasicMaterial;
}

/**
 * All precipitation kinds on one quarks BatchedRenderer, a ViewVolumeEmitter system each.
 * Systems rebuild only when the set of kinds or the frame changes; rate, fall speed,
 * colour and sway update live so a changing rate never pops.
 */
export function Precipitation({ params, frame, budget }: PrecipitationProps) {
  const s = useSceneSignals();
  const renderer = useMemo(() => new BatchedRenderer(), []);
  const specs = useMemo(() => buildSpecs(params, budget), [params, budget]);
  const live = useRef(new Map<Kind, LiveSystem>());
  const specsRef = useRef(specs);
  specsRef.current = specs;

  const kinds = specs.map((sp) => sp.kind).join("|");

  useEffect(() => {
    const created: LiveSystem[] = [];
    for (const spec of specsRef.current) {
      const def = KINDS[spec.kind];
      const material = new MeshBasicMaterial({
        map: def.texture(),
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        toneMapped: false,
        // Near-field particles: fogging them only greys them out.
        fog: false,
      });
      const rate = new ConstantValue(0);
      const color = new Vector4(...spec.color);
      const sway = spec.sway != null ? new ConstantValue(spec.sway) : null;
      const behaviors = sway ? [new Noise(new ConstantValue(0.5), sway, new ConstantValue(1))] : [];
      const emitter = new ViewVolumeEmitter(
        {
          frame,
          volume: def.volume,
          fallMin: spec.fallMin,
          fallMax: spec.fallMax,
          wind: s.windVelocity,
          windFactor: def.windFactor,
          tiles: def.tiles,
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
        startSize: new IntervalValue(def.sizeMin, def.sizeMax),
        startRotation: new IntervalValue(0, Math.PI * 2),
        startColor: new ConstantColor(color),
        emissionOverTime: rate,
        behaviors,
        material,
        renderMode: def.mode,
        rendererEmitterSettings:
          def.mode === RenderMode.StretchedBillBoard
            ? { speedFactor: def.stretch ?? 1, lengthFactor: 0 }
            : {},
        uTileCount: def.tiles ?? 1,
        vTileCount: 1,
        renderOrder: RENDER_ORDER.precipitation,
      });
      const entry: LiveSystem = { system, emitter, rate, color, sway, material };
      rate.value = (spec.max * spec.intensity) / emitter.meanLife;
      renderer.addSystem(system);
      renderer.add(system.emitter);
      live.current.set(spec.kind, entry);
      created.push(entry);
    }
    return () => {
      for (const entry of created) {
        entry.system.dispose();
        entry.material.dispose();
      }
      live.current.clear();
    };
    // `kinds` is the only spec-related input that needs a rebuild.
  }, [kinds, frame, renderer, s]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pulse = params.precip.showers
      ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1.3))
      : 1;
    for (const spec of specsRef.current) {
      const entry = live.current.get(spec.kind);
      if (!entry) continue;
      entry.rate.value = (spec.max * spec.intensity * pulse) / Math.max(0.2, entry.emitter.meanLife);
      entry.emitter.options.fallMin = spec.fallMin;
      entry.emitter.options.fallMax = spec.fallMax;
      entry.color.set(...spec.color);
      if (entry.sway && spec.sway != null) entry.sway.value = spec.sway;
    }
    renderer.update(delta);
    // quarks rebuilds batch materials without toneMapped; at exposure 0.5 particles render grey.
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
