import { useMemo } from "react";
import { Billboard } from "@react-three/drei";
import { AdditiveBlending, ShaderMaterial } from "three";
import type { SimulationConfig } from "../types";
import { PHASE_PALETTES } from "../scene/phasePalette";
import { CELESTIAL_VERT, CELESTIAL_FRAG } from "./shaders/celestial.glsl";

// Sun/moon arc geometry in scene space. Both bodies traverse a fixed arc
// across the upper hemisphere in front of the camera — simple, universal,
// can't land in a wrong-looking place regardless of latitude. The static
// camera looks toward -Z, so the arc is in the (x, y, -z) half-plane.
const ARC_RADIUS = 7; // horizontal half-span (sunrise at x=-RADIUS, sunset at +RADIUS)
const ARC_HEIGHT = 4.5; // peak altitude at solar noon
const ARC_DEPTH = 10; // forward distance from camera
const DISC_SIZE_SUN = 1.2;
const DISC_SIZE_MOON = 1.0;

interface CelestialProps {
  config: SimulationConfig;
}

interface ArcPosition {
  x: number;
  y: number;
  z: number;
  visible: boolean;
}

function sunArcPosition(config: SimulationConfig): ArcPosition {
  const dt = config.dt ?? 0;
  const { sunrise, sunset } = config;
  if (sunrise <= 0 || sunset <= 0 || sunrise >= sunset) {
    return { x: 0, y: 0, z: -ARC_DEPTH, visible: false };
  }
  // Small twilight pad so the sun doesn't pop off the moment the clock
  // crosses sunset; it dips below the horizon smoothly.
  const pad = 1200;
  if (dt < sunrise - pad || dt > sunset + pad) {
    return { x: 0, y: -10, z: -ARC_DEPTH, visible: false };
  }
  const progress = (dt - sunrise) / (sunset - sunrise);
  const angle = Math.PI * progress;
  return {
    x: -Math.cos(angle) * ARC_RADIUS,
    y: Math.sin(angle) * ARC_HEIGHT,
    z: -ARC_DEPTH,
    visible: true,
  };
}

function moonArcPosition(config: SimulationConfig): ArcPosition {
  const dt = config.dt ?? 0;
  const { sunrise, sunset } = config;
  if (sunrise <= 0 || sunset <= 0) {
    return { x: 0, y: 0, z: -ARC_DEPTH, visible: false };
  }
  // Moon window: post-sunset to next sunrise, OR pre-sunrise from the
  // previous sunset. Fallback: assume a 24h day when next_sunrise /
  // prev_sunset aren't in SimulationConfig (they're not, today).
  const DAY_S = 86400;
  let start: number;
  let end: number;
  if (dt >= sunset) {
    start = sunset;
    end = sunrise + DAY_S;
  } else if (dt < sunrise) {
    start = sunset - DAY_S;
    end = sunrise;
  } else {
    return { x: 0, y: -10, z: -ARC_DEPTH, visible: false };
  }
  const progress = Math.max(0, Math.min(1, (dt - start) / (end - start)));
  const angle = Math.PI * progress;
  return {
    x: -Math.cos(angle) * ARC_RADIUS,
    y: Math.sin(angle) * ARC_HEIGHT,
    z: -ARC_DEPTH,
    visible: true,
  };
}

interface DiscProps {
  size: number;
  color: THREE_COLOR;
  intensity: number;
  haloSize: number;
}

// Keeping this tight to avoid a full Three import — we only need the
// `Color` type shape here. Centralised in types.ts would be overkill.
type THREE_COLOR = import("three").Color;

function Disc({ size, color, intensity, haloSize }: DiscProps) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: color.clone() },
          uIntensity: { value: intensity },
          uHaloSize: { value: haloSize },
        },
        vertexShader: CELESTIAL_VERT,
        fragmentShader: CELESTIAL_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // material built once per mount; uniforms updated in the branch below
  );
  // Update uniforms on re-render (React reconciles props; material is shared).
  (material.uniforms.uColor.value as THREE_COLOR).copy(color);
  material.uniforms.uIntensity.value = intensity;
  material.uniforms.uHaloSize.value = haloSize;
  return (
    <mesh material={material}>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}

/**
 * Sun + moon on arcs across the upper sky. Both disabled when their
 * body is below the horizon — no geometry, no shader, no draw call.
 */
export function Celestial({ config }: CelestialProps) {
  const palette = PHASE_PALETTES[config.timeOfDay];
  const sunPos = sunArcPosition(config);
  const moonPos = moonArcPosition(config);

  return (
    <>
      {sunPos.visible && (
        <Billboard position={[sunPos.x, sunPos.y, sunPos.z]}>
          <Disc
            size={DISC_SIZE_SUN}
            color={palette.sunTint}
            intensity={
              config.timeOfDay === "dusk" || config.timeOfDay === "dawn"
                ? 1.4
                : 1.2
            }
            haloSize={
              config.timeOfDay === "dusk" || config.timeOfDay === "dawn"
                ? 0.55
                : 0.42
            }
          />
        </Billboard>
      )}
      {moonPos.visible && (
        <Billboard position={[moonPos.x, moonPos.y, moonPos.z]}>
          <Disc
            size={DISC_SIZE_MOON}
            color={palette.moonTint}
            intensity={1.0}
            haloSize={0.5}
          />
        </Billboard>
      )}
    </>
  );
}
