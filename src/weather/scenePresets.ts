/**
 * Debug weather presets — the weather catalogue: one per kind of sky the scene
 * draws, each with what it should show (the button's tooltip in the menu).
 */

import type { SceneOverrides } from "./overrides";
import { CLEAR_VISIBILITY_M } from "./fog";

/**
 * Every weather-describing override key; presets pin all of them so live data
 * can't leak in. Cloud base/top/CAPE are pinned too — the optical depth stays
 * "auto": with the clouds pinned it is estimated from thickness and
 * precipitation instead of the live radiation.
 */
const CALM: Required<
  Omit<SceneOverrides, "hour" | "date" | "opticalDepth" | "parallax" | "quality">
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
  visibility: CLEAR_VISIBILITY_M,
  rime: false,
  temperature: 15,
  humidity: 0.6,
  cloudBase: 1200,
  cloudTop: 2000,
  cape: 50,
};

interface WeatherPreset {
  id: string;
  label: string;
  /** What the scene shows for it. */
  note: string;
  overrides: SceneOverrides;
}

const preset = (
  id: string,
  label: string,
  note: string,
  o: Partial<typeof CALM>,
): WeatherPreset => ({ id, label, note, overrides: { ...CALM, ...o } });

export const WEATHER_PRESETS: WeatherPreset[] = [
  preset("clear", "Clear", "Open sky, a trace of cirrus; sun glow, lens flare, stars at night.", { cloudHigh: 0.1 }),
  preset("few", "Few clouds", "Scattered fair-weather cumulus over a clear sky; god rays round the sun.", { cloudLow: 0.15, cloudMid: 0.2, cloudHigh: 0.3, cloudBase: 1100, cloudTop: 2000, cape: 200 }),
  preset("partly", "Partly cloudy", "Broken cumulus with an altocumulus sheet and cirrus; blue gaps stay blue.", { cloudLow: 0.35, cloudMid: 0.5, cloudHigh: 0.4, windSpeed: 5, windGust: 9, cloudBase: 1000, cloudTop: 2400, cape: 400 }),
  preset("altocumulus", "Altocumulus", "Mid cover outweighs a thin low layer: the deck lifts to the mid level.", { cloudLow: 0.1, cloudMid: 0.7, cloudHigh: 0.3, windSpeed: 6, windGust: 9, cloudBase: 1400, cloudTop: 1800, cape: 20 }),
  preset("overcast", "Overcast", "Closed stratus deck, greyed sky and horizon, no stars or moon.", { cloudLow: 1, cloudMid: 0.8, cloudHigh: 0.5, temperature: 9, humidity: 0.8, cloudBase: 600, cloudTop: 1300, cape: 20 }),
  preset("haze", "Haze", "4 km visibility: a warm, thick horizon haze, thin cloud.", { cloudLow: 0.1, cloudHigh: 0.3, visibility: 4000, humidity: 0.7, windSpeed: 1, windGust: 2, cloudBase: 1500, cloudTop: 1900, cape: 20 }),
  preset("heat", "Heat", "Hot, dry air: pale haze, high cumulus base, a faint cirrus veil.", { cloudHigh: 0.15, visibility: 9000, temperature: 34, humidity: 0.35, windSpeed: 2, windGust: 3, cloudBase: 1800, cloudTop: 2600, cape: 600 }),
  preset("fog", "Fog", "300 m visibility: a fog deck at ground level fades the frame to grey.", { cloudLow: 1, visibility: 300, humidity: 1, temperature: 6, windSpeed: 1, windGust: 1, cloudBase: 100, cloudTop: 500, cape: 0 }),
  preset("rime", "Rime fog", "Freezing fog: rime caps visibility, frost creeps onto the glass.", { cloudLow: 1, visibility: 250, humidity: 1, temperature: -4, rime: true, windSpeed: 1, windGust: 1, cloudBase: 80, cloudTop: 400, cape: 0 }),
  preset("drizzle", "Drizzle", "Low closed deck with fine, slow, dim streaks.", { cloudLow: 1, cloudMid: 0.6, rain: 0.4, drizzle: true, visibility: 5000, humidity: 0.95, temperature: 8, cloudBase: 300, cloudTop: 900, cape: 10 }),
  preset("freezing-drizzle", "Freezing drizzle", "Drizzle below 0 °C: brighter streaks, a frost floor on the glass.", { cloudLow: 1, cloudMid: 0.6, rain: 0.4, drizzle: true, freezing: true, visibility: 4000, humidity: 0.95, temperature: -2, cloudBase: 300, cloudTop: 900, cape: 0 }),
  preset("rain", "Rain", "Moderate rain from a precipitating deck (τ ≥ 15).", { cloudLow: 1, cloudMid: 0.8, rain: 2.5, visibility: 10000, humidity: 0.9, temperature: 11, windSpeed: 5, windGust: 10, cloudBase: 500, cloudTop: 2500, cape: 100 }),
  preset("heavy-rain", "Heavy rain", "12 mm/h: dense, faster streaks under a dark, thick deck.", { cloudLow: 1, cloudMid: 1, rain: 12, visibility: 3000, humidity: 0.98, temperature: 14, windSpeed: 9, windGust: 17, cloudBase: 400, cloudTop: 4000, cape: 300 }),
  preset("freezing-rain", "Freezing rain", "Rain at −1 °C: icy-tinted drops, frost on the glass.", { cloudLow: 1, cloudMid: 0.9, rain: 2, freezing: true, visibility: 6000, humidity: 0.95, temperature: -1, cloudBase: 500, cloudTop: 2500, cape: 0 }),
  preset("showers", "Showers", "Convective cells (CAPE 900) with gaps between them, rain under them.", { cloudLow: 0.6, cloudMid: 0.6, cloudHigh: 0.3, rain: 4, showers: true, temperature: 16, windSpeed: 7, windGust: 14, cloudBase: 900, cloudTop: 5500, cape: 900 }),
  preset("sleet", "Sleet", "Rain and wet snow together, both thinned.", { cloudLow: 1, cloudMid: 0.8, rain: 1.2, snow: 0.8, visibility: 5000, humidity: 0.95, temperature: 0.8, windSpeed: 6, windGust: 11, cloudBase: 500, cloudTop: 2200, cape: 50 }),
  preset("snow", "Snow", "Light snowfall: swaying flakes, a closed deck.", { cloudLow: 1, cloudMid: 0.8, snow: 1.2, visibility: 4000, humidity: 0.9, temperature: -3, windSpeed: 3, windGust: 5, cloudBase: 600, cloudTop: 2500, cape: 30 }),
  preset("heavy-snow", "Heavy snow", "4 cm/h at 900 m visibility: dense flakes, horizon lost in snow.", { cloudLow: 1, cloudMid: 1, snow: 4, visibility: 900, humidity: 0.95, temperature: -5, windSpeed: 4, windGust: 7, cloudBase: 500, cloudTop: 3200, cape: 50 }),
  preset("grains", "Snow grains", "Snow grains: small, fast, round particles instead of flakes.", { cloudLow: 1, cloudMid: 0.5, snow: 0.3, grains: true, visibility: 8000, humidity: 0.9, temperature: -6, cloudBase: 400, cloudTop: 1500, cape: 0 }),
  preset("blizzard", "Blizzard", "Wind-driven snow at 250 m visibility, flakes driven sideways.", { cloudLow: 1, cloudMid: 1, snow: 3, visibility: 250, humidity: 0.95, temperature: -9, windSpeed: 17, windGust: 27, cloudBase: 400, cloudTop: 2500, cape: 50 }),
  preset("thunderstorm", "Thunderstorm", "Cumulonimbus to 11 km with an anvil, heavy rain, lightning flashes.", { cloudLow: 1, cloudMid: 1, cloudHigh: 0.8, rain: 9, showers: true, thunder: true, visibility: 5000, humidity: 0.95, temperature: 19, windSpeed: 9, windGust: 20, cloudBase: 1100, cloudTop: 11000, cape: 2500 }),
  preset("hailstorm", "Hailstorm", "A taller cumulonimbus with hail streaks on top of the rain and lightning.", { cloudLow: 1, cloudMid: 1, cloudHigh: 0.8, rain: 7, showers: true, thunder: true, hail: true, visibility: 4000, humidity: 0.95, temperature: 17, windSpeed: 11, windGust: 24, cloudBase: 1200, cloudTop: 12000, cape: 3200 }),
  preset("frosty", "Frosty (−8 °C)", "−8 °C, mostly clear: the frosted pane grows in from the edges.", { cloudLow: 0.2, cloudHigh: 0.2, visibility: 18000, humidity: 0.8, temperature: -8, windSpeed: 2, windGust: 3, cloudBase: 900, cloudTop: 1300, cape: 0 }),
  preset("hard-frost", "Hard frost (−20 °C)", "−20 °C: full frost on the glass, clear sky.", { cloudHigh: 0.1, visibility: 20000, humidity: 0.85, temperature: -20, windSpeed: 1, windGust: 2, cloudBase: 1000, cloudTop: 1300, cape: 0 }),
  preset("diamond-dust", "Diamond dust", "−18 °C, clear and humid: glinting ice crystals in the air.", { cloudHigh: 0.1, visibility: 15000, humidity: 0.85, temperature: -18, windSpeed: 1, windGust: 1, cloudBase: 1000, cloudTop: 1300, cape: 0 }),
  preset("gale", "Gale", "19 m/s with 30 m/s gusts: broken cloud racing across the frame.", { cloudLow: 0.55, cloudMid: 0.5, cloudHigh: 0.4, windSpeed: 19, windGust: 30, humidity: 0.6, temperature: 10, cloudBase: 900, cloudTop: 2200, cape: 150 }),
];
