/** Unit systems: what Open-Meteo is asked for, how values are labelled, and the way back to SI. */

import type { Units } from "./types";

interface UnitSystem {
  /** Open-Meteo `temperature_unit` / `wind_speed_unit`. */
  temperatureApi: string;
  windApi: string;
  tempSymbol: string;
  speedLabel: string;
  toCelsius: (t: number) => number;
  toMs: (speed: number) => number;
}

export const UNITS: Record<Units, UnitSystem> = {
  metric: {
    temperatureApi: "celsius",
    windApi: "kmh",
    tempSymbol: "°C",
    speedLabel: "km/h",
    toCelsius: (t) => t,
    toMs: (v) => v / 3.6,
  },
  imperial: {
    temperatureApi: "fahrenheit",
    windApi: "mph",
    tempSymbol: "°F",
    speedLabel: "mph",
    toCelsius: (t) => ((t - 32) * 5) / 9,
    toMs: (v) => v * 0.44704,
  },
};
