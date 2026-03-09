/** Shared time-of-day color palettes for fog and mist effects. */
import * as THREE from "three";

export const FOG_COLOR_BY_TIME: Record<string, number> = {
  day: 0x8fbdd4,
  dawn: 0xf79c5b,
  dusk: 0xf2bb93,
  night: 0x4a6070,
};
export const FOG_COLOR_THUNDERSTORM = 0x2a3542;

export const MIST_COLOR_BY_TIME: Record<string, THREE.Color> = {
  day: new THREE.Color(0xc8dde8),
  dawn: new THREE.Color(0xf7b87a),
  dusk: new THREE.Color(0xf2c8a8),
  night: new THREE.Color(0x6a8090),
};
export const MIST_COLOR_THUNDERSTORM = new THREE.Color(0x3a4a56);

export function getFogColor(timeOfDay: string, thunderstorm: boolean): number {
  return thunderstorm
    ? FOG_COLOR_THUNDERSTORM
    : (FOG_COLOR_BY_TIME[timeOfDay] ?? FOG_COLOR_BY_TIME.day);
}

export function getMistColor(timeOfDay: string, thunderstorm: boolean): THREE.Color {
  return thunderstorm
    ? MIST_COLOR_THUNDERSTORM
    : (MIST_COLOR_BY_TIME[timeOfDay] ?? MIST_COLOR_BY_TIME.day);
}
