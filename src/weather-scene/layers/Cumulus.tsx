import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import { Color, type Group, MathUtils, MeshLambertMaterial, type Object3D, Vector3 } from "three";
import type { SceneParams } from "../../weather/sceneParams";
import type { QualityBudget } from "../core/quality";
import { useSceneSignals } from "../core/sceneSignals";
import {
  elevatedBand,
  halfWidthAt,
  type ViewFrame,
} from "../core/viewVolume";
import {
  CLOUD_WIND_SCALE,
  CUMULUS_FAR,
  CUMULUS_RADIUS,
  CUMULUS_Y_MAX,
  CUMULUS_Y_MIN,
} from "../core/worldFrame";

interface CumulusProps {
  params: SceneParams;
  frame: ViewFrame;
  budget: QualityBudget;
}

const DAY_GLOW = new Color("#e4e8ee");
const NIGHT_GLOW = new Color("#1d2230");
const STORM_GLOW = new Color("#4a4f58");

interface Slot {
  seed: number;
  scale: number;
  position: Vector3;
}

/** How much of the sky is fair-weather / shower cumulus (0..1); none under a closed deck. */
export function cumulusAmount(params: SceneParams): number {
  const { low, mid } = params.clouds;
  const base = MathUtils.smoothstep(Math.max(low, mid), 0.05, 0.55);
  const closed = MathUtils.smoothstep(low, 0.8, 0.97);
  const boost = params.precip.showers ? 1.3 : 1;
  return Math.min(1, base * boost) * (1 - closed);
}

/**
 * drei <Clouds>/<Cloud> — one instanced draw for every puff. Clouds live only
 * in the band of sky the camera sees (view volume), drift with the wind and
 * wrap to the upwind edge once they leave it; every edge of the band is
 * off-screen or deep in the horizon fog, so the wrap is never visible.
 *
 * Budget: clouds × segments sprites, capped by the quality tier. Overcast is
 * the deck's job — at that point this layer is empty (the old full-cover
 * sprite approach is what melted GPUs).
 */
export function Cumulus({ params, frame, budget }: CumulusProps) {
  const s = useSceneSignals();
  const groupRef = useRef<Group>(null);
  const cloudMaterial = useRef<MeshLambertMaterial | null>(null);
  const glow = useRef(new Color());
  const cloudRefs = useRef<(Group | null)[]>([]);

  const band = useMemo(
    () => elevatedBand(frame, CUMULUS_Y_MIN, CUMULUS_Y_MAX, CUMULUS_FAR, CUMULUS_RADIUS),
    [frame],
  );
  const count = Math.round(budget.cumulusClouds * cumulusAmount(params));
  const towering = params.precip.showers || params.thunder;

  const slots = useMemo<Slot[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      // Biased towards the viewer — far puffs are tiny and lost in the haze anyway.
      const d = MathUtils.lerp(band.dNear, band.dFar, Math.pow(Math.random(), 1.6));
      const y = MathUtils.lerp(band.yMin, band.yMax, Math.random());
      const hw = halfWidthAt(frame, d, y);
      return {
        seed: i * 7 + 1,
        scale: MathUtils.lerp(0.7, 1.35, Math.random()),
        position: new Vector3((Math.random() * 2 - 1) * hw, y, -d),
      };
    });
  }, [count, band, frame]);

  useLayoutEffect(() => {
    // Draw after the deck (renderOrder 2) — cumulus hang below it.
    groupRef.current?.traverse((o: Object3D) => {
      o.renderOrder = 3;
      const m = (o as { material?: unknown }).material;
      if (m instanceof MeshLambertMaterial) cloudMaterial.current = m;
    });
  });

  useFrame((_state, delta) => {
    // Sprites face the camera and the sun is usually in front of it, so pure
    // Lambert would leave them back-lit and grey. Emissive carries the base
    // daylight colour; lights add direction, moonlight and lightning.
    const m = cloudMaterial.current;
    if (m) {
      const g = glow.current.copy(NIGHT_GLOW).lerp(DAY_GLOW, s.day);
      g.lerp(s.sunColor, s.warmth * 0.45);
      if (params.thunder) g.lerp(STORM_GLOW, 0.6);
      m.emissive.copy(g);
    }
    const dt = Math.min(delta, 0.1) * CLOUD_WIND_SCALE;
    const dx = s.windVelocity.x * dt;
    const dz = s.windVelocity.z * dt;
    const depth = band.dFar - band.dNear;
    for (let i = 0; i < slots.length; i++) {
      const p = slots[i].position;
      p.x += dx;
      p.z += dz;
      // Depth wrap: past the horizon end → re-enter above the top of the frame, and vice versa.
      let d = -p.z;
      if (d > band.dFar) d -= depth;
      else if (d < band.dNear) d += depth;
      p.z = -d;
      // Lateral wrap just outside the frame edge at this distance.
      const hw = halfWidthAt(frame, d, p.y) + CUMULUS_RADIUS;
      if (p.x > hw) p.x -= 2 * hw;
      else if (p.x < -hw) p.x += 2 * hw;
      cloudRefs.current[i]?.position.copy(p);
    }
  });

  if (count === 0) return null;

  const color = params.thunder ? "#9aa0aa" : params.precip.showers ? "#d3d7de" : "#ffffff";

  return (
    <group ref={groupRef}>
      <Clouds
        material={MeshLambertMaterial}
        limit={budget.cumulusClouds * budget.cumulusSegments}
        texture="/effects/cloud.png"
        frustumCulled={false}
      >
        {slots.map((slot, i) => (
          <Cloud
            key={slot.seed}
            ref={(el: Group | null) => {
              cloudRefs.current[i] = el;
            }}
            position={slot.position}
            seed={slot.seed}
            segments={budget.cumulusSegments}
            bounds={[46 * slot.scale, (towering ? 26 : 12) * slot.scale, 18 * slot.scale]}
            volume={26 * slot.scale}
            smallestVolume={0.35}
            concentrate="inside"
            growth={3}
            speed={0.12}
            fade={110}
            opacity={0.95}
            color={color}
          />
        ))}
      </Clouds>
    </group>
  );
}
