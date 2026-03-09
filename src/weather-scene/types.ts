/** Simulation types. Re-exports weather domain; adds FrustumBounds. */

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
