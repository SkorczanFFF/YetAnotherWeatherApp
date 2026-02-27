/**
 * Re-exports config mapping from weather domain.
 * WeatherData + DebugOverrides → SimulationConfig.
 */

export {
  mapToSimulationConfig,
  getTimeOfDayPhase,
  getSunProgress,
  type DebugOverrides,
  type SimulationConfig,
  type TimeOfDayPhase,
} from "../../weather/config";
