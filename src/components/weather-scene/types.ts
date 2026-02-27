import type { WeatherData } from "../../types/weather";
import type {
  SimulationConfig,
  TimeOfDayPhase,
  DebugOverrides,
} from "../../weather/config";
import type { EffectType, Intensity } from "../../weather/codes";

export type WeatherEffectType = EffectType;
export type WeatherIntensity = Intensity;
export type { TimeOfDayPhase, DebugOverrides };

export interface WeatherSceneProps {
  weather: WeatherData | null;
  overrides?: DebugOverrides | null;
}

/** Resolved config: weather + overrides applied */
export interface ResolvedSceneConfig extends SimulationConfig {}
