/** Debug weather presets — one per row of the "weather catalogue" in SCENE_REFACTOR.md. */

import type { SceneOverrides } from "./sceneParams";

/** Every weather-describing override key; presets pin all of them so live data can't leak in. */
const CALM: Required<
  Pick<
    SceneOverrides,
    | "cloudLow"
    | "cloudMid"
    | "cloudHigh"
    | "windSpeed"
    | "windGust"
    | "windFrom"
    | "rain"
    | "snow"
    | "drizzle"
    | "freezing"
    | "showers"
    | "hail"
    | "grains"
    | "thunder"
    | "visibility"
    | "rime"
    | "temperature"
    | "humidity"
  >
> = {
  cloudLow: 0,
  cloudMid: 0,
  cloudHigh: 0,
  windSpeed: 3,
  windGust: 5,
  windFrom: 270,
  rain: 0,
  snow: 0,
  drizzle: false,
  freezing: false,
  showers: false,
  hail: false,
  grains: false,
  thunder: false,
  visibility: 24000,
  rime: false,
  temperature: 15,
  humidity: 0.6,
};

export interface WeatherPreset {
  id: string;
  label: string;
  overrides: SceneOverrides;
}

const preset = (
  id: string,
  label: string,
  o: Partial<typeof CALM>,
): WeatherPreset => ({ id, label, overrides: { ...CALM, ...o } });

export const WEATHER_PRESETS: WeatherPreset[] = [
  preset("clear", "Clear", { cloudHigh: 0.1 }),
  preset("few", "Few clouds", { cloudLow: 0.15, cloudMid: 0.2, cloudHigh: 0.3 }),
  preset("partly", "Partly cloudy", { cloudLow: 0.35, cloudMid: 0.5, cloudHigh: 0.4, windSpeed: 5, windGust: 9 }),
  preset("overcast", "Overcast", { cloudLow: 1, cloudMid: 0.8, cloudHigh: 0.5, temperature: 9, humidity: 0.8 }),
  preset("haze", "Haze", { cloudLow: 0.1, cloudHigh: 0.3, visibility: 4000, humidity: 0.7, windSpeed: 1, windGust: 2 }),
  preset("heat", "Heat", { cloudHigh: 0.15, visibility: 9000, temperature: 34, humidity: 0.35, windSpeed: 2, windGust: 3 }),
  preset("fog", "Fog", { cloudLow: 1, visibility: 300, humidity: 1, temperature: 6, windSpeed: 1, windGust: 1 }),
  preset("rime", "Rime fog", { cloudLow: 1, visibility: 250, humidity: 1, temperature: -4, rime: true, windSpeed: 1, windGust: 1 }),
  preset("drizzle", "Drizzle", { cloudLow: 1, cloudMid: 0.6, rain: 0.4, drizzle: true, visibility: 5000, humidity: 0.95, temperature: 8 }),
  preset("freezing-drizzle", "Freezing drizzle", { cloudLow: 1, cloudMid: 0.6, rain: 0.4, drizzle: true, freezing: true, visibility: 4000, humidity: 0.95, temperature: -2 }),
  preset("rain", "Rain", { cloudLow: 1, cloudMid: 0.8, rain: 2.5, visibility: 10000, humidity: 0.9, temperature: 11, windSpeed: 5, windGust: 10 }),
  preset("heavy-rain", "Heavy rain", { cloudLow: 1, cloudMid: 1, rain: 12, visibility: 3000, humidity: 0.98, temperature: 14, windSpeed: 9, windGust: 17 }),
  preset("freezing-rain", "Freezing rain", { cloudLow: 1, cloudMid: 0.9, rain: 2, freezing: true, visibility: 6000, humidity: 0.95, temperature: -1 }),
  preset("showers", "Showers", { cloudLow: 0.6, cloudMid: 0.6, cloudHigh: 0.3, rain: 4, showers: true, temperature: 16, windSpeed: 7, windGust: 14 }),
  preset("sleet", "Sleet", { cloudLow: 1, cloudMid: 0.8, rain: 1.2, snow: 0.8, visibility: 5000, humidity: 0.95, temperature: 0.8, windSpeed: 6, windGust: 11 }),
  preset("snow", "Snow", { cloudLow: 1, cloudMid: 0.8, snow: 1.2, visibility: 4000, humidity: 0.9, temperature: -3, windSpeed: 3, windGust: 5 }),
  preset("heavy-snow", "Heavy snow", { cloudLow: 1, cloudMid: 1, snow: 4, visibility: 900, humidity: 0.95, temperature: -5, windSpeed: 4, windGust: 7 }),
  preset("grains", "Snow grains", { cloudLow: 1, cloudMid: 0.5, snow: 0.3, grains: true, visibility: 8000, humidity: 0.9, temperature: -6 }),
  preset("blizzard", "Blizzard", { cloudLow: 1, cloudMid: 1, snow: 3, visibility: 250, humidity: 0.95, temperature: -9, windSpeed: 17, windGust: 27 }),
  preset("thunderstorm", "Thunderstorm", { cloudLow: 1, cloudMid: 1, cloudHigh: 0.8, rain: 9, showers: true, thunder: true, visibility: 5000, humidity: 0.95, temperature: 19, windSpeed: 9, windGust: 20 }),
  preset("hailstorm", "Hailstorm", { cloudLow: 1, cloudMid: 1, cloudHigh: 0.8, rain: 7, showers: true, thunder: true, hail: true, visibility: 4000, humidity: 0.95, temperature: 17, windSpeed: 11, windGust: 24 }),
  preset("diamond-dust", "Diamond dust", { cloudHigh: 0.1, visibility: 15000, humidity: 0.85, temperature: -18, windSpeed: 1, windGust: 1 }),
  preset("gale", "Gale", { cloudLow: 0.55, cloudMid: 0.5, cloudHigh: 0.4, windSpeed: 19, windGust: 30, humidity: 0.6, temperature: 10 }),
];
