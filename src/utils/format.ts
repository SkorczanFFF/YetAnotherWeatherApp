/** Display formatting: times in the location zone, temperatures, speeds, bearings, coordinates. */

import { DateTime } from "luxon";
import type { Units } from "../weather/types";
import { UNITS } from "../weather/units";

export const formatToLocalTime = (secs: number, zone: string, format: string): string =>
  DateTime.fromSeconds(secs).setZone(zone).toFormat(format);

export const tempSymbol = (units: Units): string => UNITS[units].tempSymbol;

/** Rounded degrees without a unit; `|| 0` turns −0 into 0. */
export const formatDegrees = (value: number): string => `${Math.round(value) || 0}°`;

export const formatTemperature = (value: number, units: Units): string =>
  `${Math.round(value) || 0}${tempSymbol(units)}`;

export const formatSpeed = (value: number, units: Units): string =>
  `${value.toFixed()} ${UNITS[units].speedLabel}`;

const CARDINALS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

/** Degree bearing → 16-point compass label. `undefined`/`NaN` yields `""`. */
export const toCardinal = (deg?: number): string => {
  if (deg == null || Number.isNaN(deg)) return "";
  const idx = Math.round((deg % 360) / 22.5) % 16;
  return CARDINALS[idx];
};

/** "50.26, 19.02" */
export const formatCoords = (lat: number, lon: number, digits = 2): string =>
  `${lat.toFixed(digits)}, ${lon.toFixed(digits)}`;

/** "Lat 50.26 · Lon 19.02" */
export const formatLatLon = (lat: number, lon: number, digits = 2): string =>
  `Lat ${lat.toFixed(digits)} · Lon ${lon.toFixed(digits)}`;

/** "GMT+2" for an IANA zone; "" when unknown. */
export const formatGmtOffset = (timezone?: string): string => {
  if (!timezone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
};
