import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { type Group, MathUtils, Vector3 } from "three";
import { useSceneSignals } from "../core/sceneSignals";
import { halfWidthAt, type ViewFrame } from "../core/viewVolume";
import { METRES_PER_UNIT } from "../core/worldFrame";
import { RENDER_ORDER } from "../core/constants";

/** Bolt top in scene units: just inside the cloud base from the cloud physics. */
const boltTopY = (cloudBaseM: number) => (Math.max(300, cloudBaseM) * 1.05) / METRES_PER_UNIT;

interface ThunderProps {
  enabled: boolean;
  /** Low-cloud base above ground, m (params.cloudPhysics.baseM). */
  cloudBaseM: number;
  /** Increment to force a strike now (debug), even without a storm. */
  nonce: number;
  frame: ViewFrame;
  isMobile: boolean;
}

const MIN_INTERVAL_S = 4;
const MAX_INTERVAL_S = 12;
const FLASH_DURATION_S = 0.35;
const SECOND_BUMP_CHANCE = 0.5;
/** Bolts strike somewhere between these distances, inside the frame. */
const STRIKE_NEAR = 120;
const STRIKE_FAR = 450;

/** `segments`: point pairs for drei <Line segments> — trunk + branches in one draw. */
type Bolt = { main: Vector3[]; segments: Vector3[] };

/** Jagged polyline from `a` to `b` by recursive midpoint displacement. */
function jagged(a: Vector3, b: Vector3, roughness: number, depth: number, out: Vector3[]) {
  if (depth === 0) {
    out.push(b.clone());
    return;
  }
  const mid = a.clone().lerp(b, 0.5);
  const len = a.distanceTo(b);
  mid.x += (Math.random() * 2 - 1) * len * roughness;
  mid.z += (Math.random() * 2 - 1) * len * roughness * 0.5;
  mid.y += (Math.random() * 2 - 1) * len * roughness * 0.2;
  jagged(a, mid, roughness, depth - 1, out);
  jagged(mid, b, roughness, depth - 1, out);
}

function makeBolt(frame: ViewFrame, topY: number): Bolt {
  const d = MathUtils.lerp(STRIKE_NEAR, STRIKE_FAR, Math.random());
  const hw = halfWidthAt(frame, d, topY) * 0.8;
  const x = (Math.random() * 2 - 1) * hw;
  // From the cloud base to just below the horizon line at that distance.
  const top = new Vector3(x, topY, -d);
  const bottom = new Vector3(x + (Math.random() - 0.5) * 40, -d * 0.02, -d);
  const main: Vector3[] = [top.clone()];
  jagged(top, bottom, 0.22, 6, main);
  const segments: Vector3[] = [];
  const addSegments = (pts: Vector3[]) => {
    for (let i = 1; i < pts.length; i++) segments.push(pts[i - 1], pts[i]);
  };
  addSegments(main);
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const start = main[Math.floor(MathUtils.lerp(0.15, 0.6, Math.random()) * main.length)];
    const end = start
      .clone()
      .add(new Vector3((Math.random() - 0.5) * 60, -MathUtils.lerp(15, 35, Math.random()), 0));
    const pts: Vector3[] = [start.clone()];
    jagged(start, end, 0.3, 4, pts);
    addSegments(pts);
  }
  return { main, segments };
}

/**
 * Strikes every 4–12 s: a branching bolt inside the frame, `signals.flash` (sharp attack,
 * exponential decay, optional second pulse) and `signals.flashPosition` for the clouds.
 * Time only from the R3F clock — mixing in performance.now() offsets by the page's age.
 */
export function Thunder({ enabled, cloudBaseM, nonce, frame, isMobile }: ThunderProps) {
  const s = useSceneSignals();
  const [bolt, setBolt] = useState<Bolt | null>(null);
  const group = useRef<Group>(null);
  const next = useRef(-1);
  const start = useRef(-Infinity);
  const secondAt = useRef(-1);
  const peak = useRef(1);
  const forced = useRef(false);

  useEffect(() => {
    if (nonce > 0) forced.current = true;
  }, [nonce]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (next.current < 0) next.current = t + 1 + Math.random() * 2;

    if (forced.current || (enabled && t >= next.current)) {
      forced.current = false;
      const b = makeBolt(frame, boltTopY(cloudBaseM));
      setBolt(b);
      start.current = t;
      secondAt.current = Math.random() < SECOND_BUMP_CHANCE ? t + 0.09 : -1;
      const d = -b.main[0].z;
      peak.current =
        (isMobile ? 0.7 : 1) * MathUtils.lerp(1, 0.55, (d - STRIKE_NEAR) / (STRIKE_FAR - STRIKE_NEAR));
      s.flashPosition.copy(b.main[Math.floor(b.main.length * 0.3)]);
      next.current = t + MathUtils.lerp(MIN_INTERVAL_S, MAX_INTERVAL_S, Math.random());
    }

    const e1 = t - start.current;
    let env = 0;
    if (e1 >= 0 && e1 < FLASH_DURATION_S) {
      env = Math.min(1, e1 / 0.015) * Math.exp(-e1 * 14);
    }
    if (secondAt.current > 0 && t >= secondAt.current) {
      const e2 = t - secondAt.current;
      if (e2 < FLASH_DURATION_S) env += Math.min(1, e2 / 0.012) * Math.exp(-e2 * 18) * 0.6;
    }
    s.flash = env * peak.current;

    if (group.current) group.current.visible = env > 0.12;
  });

  if (!bolt) return null;

  return (
    <group ref={group} renderOrder={RENDER_ORDER.thunder}>
      <Line points={bolt.segments} segments color="#c9d6ff" lineWidth={7} transparent opacity={0.3} toneMapped={false} fog={false} />
      <Line points={bolt.segments} segments color="#f4f7ff" lineWidth={2.4} transparent toneMapped={false} fog={false} />
    </group>
  );
}
