/** Precipitation in the scene: rates from the gauge (code-typical ones when it reads 0) and the code's flags. */

import type { WeatherData } from "./types";
import { type CodeInfo, fallsLiquid, type Intensity } from "./codes";

export interface PrecipState {
  /** Liquid precipitation (rain + showers), mm/h. */
  rainMmH: number;
  /** Snowfall, cm/h. Both > 0 = sleet. */
  snowCmH: number;
  /** WMO 51–57 — small, slow, dense drops. */
  drizzle: boolean;
  /** WMO 56/57/66/67, or liquid below 0 °C — glaze. */
  freezing: boolean;
  /** Convective (WMO 80–86, 95–99) — towering cumulus, pulsing intensity. */
  showers: boolean;
  /** WMO 96, 99. */
  hail: boolean;
  /** WMO 77 — snow grains instead of flakes. */
  grains: boolean;
}

export const DRY: PrecipState = {
  rainMmH: 0,
  snowCmH: 0,
  drizzle: false,
  freezing: false,
  showers: false,
  hail: false,
  grains: false,
};

/** The rates, and each flag only where something falls to carry it (drizzle and glaze are liquid, grains are snow). */
export function finalizePrecip(
  rainMmH: number,
  snowCmH: number,
  flags: Omit<PrecipState, "rainMmH" | "snowCmH">,
): PrecipState {
  return {
    rainMmH,
    snowCmH,
    drizzle: flags.drizzle && rainMmH > 0,
    freezing: flags.freezing && rainMmH > 0,
    showers: flags.showers,
    hail: flags.hail,
    grains: flags.grains && snowCmH > 0,
  };
}

/** Fallbacks when the code says it's precipitating but the gauge reads 0. */
const FALLBACK_RAIN_MM_H: Record<Intensity, number> = {
  light: 0.8,
  moderate: 3,
  heavy: 8,
};
const FALLBACK_DRIZZLE_MM_H: Record<Intensity, number> = {
  light: 0.2,
  moderate: 0.5,
  heavy: 1,
};
const FALLBACK_SNOW_CM_H: Record<Intensity, number> = {
  light: 0.5,
  moderate: 1.5,
  heavy: 4,
};
/** Open-Meteo converts snow water equivalent with 0.7 cm per mm. */
const SNOW_CM_PER_MM = 0.7;

export function precipFromWeather(weather: WeatherData, info: CodeInfo, temperatureC: number): PrecipState {
  const liquid = fallsLiquid(info);
  const frozen = info.kind === "snow";
  const drizzle = info.kind === "drizzle";
  const gaugeTotal = Math.max(0, weather.precipitation ?? 0);
  const hasSplit =
    weather.rain != null || weather.showers != null || weather.snowfall != null;

  let rainMmH = hasSplit
    ? Math.max(0, (weather.rain ?? 0) + (weather.showers ?? 0))
    : liquid
      ? gaugeTotal
      : 0;
  let snowCmH = hasSplit
    ? Math.max(0, weather.snowfall ?? 0)
    : frozen
      ? gaugeTotal * SNOW_CM_PER_MM
      : 0;

  // Code says it's falling but the gauge rounded to 0 — use typical rates.
  if (liquid && rainMmH === 0 && snowCmH === 0) {
    rainMmH = (drizzle ? FALLBACK_DRIZZLE_MM_H : FALLBACK_RAIN_MM_H)[info.intensity];
  }
  if (frozen && snowCmH === 0 && rainMmH === 0) {
    snowCmH = FALLBACK_SNOW_CM_H[info.intensity] * (info.grains ? 0.3 : 1);
  }
  // Code says dry but the gauge disagrees with no split available — trust the gauge.
  if (!liquid && !frozen && !hasSplit && gaugeTotal > 0.05) {
    if (temperatureC < 0.5) snowCmH = gaugeTotal * SNOW_CM_PER_MM;
    else rainMmH = gaugeTotal;
  }

  return finalizePrecip(rainMmH, snowCmH, {
    drizzle,
    freezing: !!info.freezing || temperatureC < 0,
    showers: !!info.showers,
    hail: !!info.hail,
    grains: !!info.grains,
  });
}
