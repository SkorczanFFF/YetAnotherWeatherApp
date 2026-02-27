/**
 * Weather Simulation Engine — types.
 * Re-exports from weather domain; adds FrustumBounds and WeatherEffect contract.
 */

import type * as THREE from "three";
import type { SimulationConfig } from "../weather/types";

export type {
  EffectType,
  Intensity,
  TimeOfDay,
  SimulationConfig,
} from "../weather/types";

export interface FrustumBounds {
  spawnYMin: number;
  spawnYMax: number;
  spawnXMin: number;
  spawnXMax: number;
  spawnZMin: number;
  spawnZMax: number;
  recycleY: number;
  recycleXMin: number;
  recycleXMax: number;
  recycleZMin: number;
  recycleZMax: number;
}

export interface WeatherEffect {
  init(scene: THREE.Scene, config: SimulationConfig): void;
  update(dt: number, config: SimulationConfig, bounds: FrustumBounds): void;
  dispose(): void;
}
