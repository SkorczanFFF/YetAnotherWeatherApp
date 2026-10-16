import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Material, MeshBasicMaterial, NormalBlending } from "three";
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
import type { ViewFrame } from "../../core/viewVolume";
import { buildSpecs, initialMeanLife, type Kind, KINDS } from "./kinds";
import { ViewVolumeEmitter } from "./ViewVolumeEmitter";
import { RENDER_ORDER } from "../../core/constants";

interface PrecipitationProps {
  params: SceneParams;
  frame: ViewFrame;
  budget: QualityBudget;
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
  const specs = useMemo(() => buildSpecs(params, budget), [params, budget]);
  const live = useRef(new Map<Kind, LiveSystem>());
  const specsRef = useRef(specs);
  specsRef.current = specs;

  const kinds = specs.map((sp) => sp.kind).join("|");
  // A fresh renderer per rebuild: quarks never drops a batch whose systems are
  // gone, so reusing one would pile up a geometry + material per rebuild.
  const renderer = useMemo(() => new BatchedRenderer(), [kinds, frame]);

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
      for (const batch of renderer.batches) {
        batch.dispose();
        (batch.material as Material).dispose();
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
