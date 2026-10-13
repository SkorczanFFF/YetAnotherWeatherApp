# Changelog

Notable changes, newest first. Dates are commit dates; history before 2026-10 is condensed from `git log`.

## Unreleased

### Changed (comments)
- Comments cut to the why: no history narration or essays duplicating CLAUDE.md, short file headers; wrong ones fixed (WMO ranges in `PrecipState`, precipitation units, flash range, fall-speed units, `uType` list, fetch cancellation wording).

### Changed (file organisation)
- `services/weatherFormatter.ts` → `services/openMeteoMapper.ts` (API → app data only); `fetchWeather` is a named export.
- `App.tsx` keeps state and layout; fetching, refresh and error text live in `hooks/useWeather`, the F7 / 5-tap toggle in `hooks/useDebugToggle`; `useGlassSpotlight` moved to `hooks/`.
- `weather/sceneParams.ts` split into `sceneParams.ts`, `overrides.ts` and `frost.ts`.
- Volumetric clouds split into `layers/clouds/` (renderer, `shellTargets`, `cloudNoise3D`, `fullscreenPass`); `WeatherSceneContainer` moved into `weather-scene/`.
- Precipitation: one static table per kind; a system is rebuilt only when the set of kinds changes, rate/fall speed/colour/sway update live (a rate change no longer pops the particles).
- The cloud noise cache is keyed by renderer, so a remount with a new WebGL context regenerates it instead of reusing a dead texture.
- Named exports everywhere except `App`; README brought up to date.

### Changed (single sources of truth)
- One WMO table (`weather/codes.ts`) for the scene, the labels and the icons. Fixes light freezing drizzle (56) and snow grains (77), which were treated as heavy (1 mm/h and 1.2 cm/h fallbacks).
- Units, requested API fields, override and shell keys (type-checked), quality tiers, render orders, tone exposure, frame-delta cap, scene palette, shared GLSL helpers, display formatting (`utils/format.ts`), math helpers, the forecast day count and the default location each defined once.
- The freezing level falls back to the standard lapse rate (was a flat 3 km); a debug-pinned cloud base is no longer overridden under fog.
- UI: `LineIcon`/`CloseIcon`, SCSS breakpoint and label mixins, accent tints derived from `--accent-warm`; narrow grids use `minmax(0, 1fr)` so long content can't overflow.

### Removed
- Unread API fields (hourly precipitation probability and weather code, geocoder ids, response units), the generic endpoint parameter, the dead `NETWORK_ERROR` path and `getSunAltitude`.
- `react-dom/server` from the bundle (map marker is a static Leaflet `divIcon`): −197 kB (−60 kB gzip).
- The missing `logo192.png` link, the CRA `browserslist` and a second Toastify stylesheet (v11 injects its own).

### Fixed
- Sunrise/sunset, hourly labels and forecast day names were shifted by the difference between the browser's and the location's time zone.
- Clouds slid sideways whenever the low-deck noise scale changed, worse the longer the page was open; the frame counter no longer grows without bound (banding after hours, unmarched pixels after ~77 h).
- Map picker: the picked point and focus no longer reset on every app re-render; the closed drawer is out of the tab order.
- "-0°" for temperatures just below zero.
- A pinned quality tier no longer lowers the automatic one; the lightning bolt core is no longer greyed by the sky.
- Open-Meteo error reasons are kept (logged); a failing geocoder reports a service error, not "City not found"; measured precipitation with null rain/showers/snowfall is no longer dropped.
- Debug: pinning e.g. the hour no longer adds rain to measured thunder or hail; a pinned CAPE keeps the shower/storm convection floor; cirrus no longer lifts the fair-weather cumulus cap to ~9 km.
- Weather refreshes silently every 15 minutes, so current conditions and the hourly chart don't go stale.

### Scene
- Camera pitched up 22° (was 16°): the frame spans −3°…+47°, a thin horizon strip and mostly sky.
- Low decks: cloud noise (cover, shape, detail) scales with the deck's height (`uFeatureScale`, 0.2–1 of the cumulus size), so a 150–300 m deck is no longer one cell filling the frame.
- Stable cloud top: an inversion just above the base gives a thin deck (≥ 100 m) instead of a 900 m slab; with no cloudy pressure level, the first clear level above the base caps the top. Shell thickness may go down to 80 m.
- The sky turns grey only under a closing deck (≥ 80 % low / 85 % mid); broken decks keep blue gaps. The UI backlight uses a separate `cloudFill` signal with the old curve.

### Data
- The current weather label and icon are derived from the shown cloud cover for pure cloud codes (0–3), using Open-Meteo's thresholds (20 / 50 / 80 %). The 15-min `weather_code` is the step of the coming hour, while `cloud_cover` is interpolated ("Mainly clear" next to 66 %).

### UI
- One line-art `WeatherIcon` for the hero and the forecast tiles. It replaces the OpenWeatherMap PNGs hotlinked by the forecast and the hero's own mapping. Fixed: a bare sun for "mainly clear", a sun at night for "partly cloudy", rain/shower icons swapped, snowflakes for freezing rain, rain as the fallback. Day/night variants, intensity-scaled marks, rime fog, hail.
- README stack table: icons are our own SVGs (react-icons was never a dependency).

## 2026-10-12
- Cloud cover drawn as measured: calibrated coverage and cirrus; cirrus is no longer turned into cumulus; radiation-based optical depth trusted only for closing decks; debug pins no longer change real clouds.
- Adaptive cloud march (cheap steps through empty air, distance-scaled fine steps) with a variance-clipped temporal resolve; weather changes morph the clouds instead of resetting.
- API-driven cloud physics (LCL base, CAPE tops, radiation optical depth, winds aloft) and a procedural frosted glass that grows gradually.
- Adaptive liquid-glass UI driven by scene brightness; liquid-glass loaders; data stays readable (blurred) while refetching.
- Cursor edge reveal on every UI element, 5-tap debug entry on phones, two-line logo, map drawer on the dynamic viewport, lat/lon 0 fix.
- Removed the takram test renderer, the free camera, spawn-volume wireframes and unused deps.

## 2026-10-11
- Volumetric raymarched clouds with temporal accumulation; the flat deck stays as the potato-tier fallback.
- Frame gate renders every N-th display frame for even pacing.

## 2026-10-10 — scene rewrite
- New scene core: world frame, view volumes, quality tiers, scene signals and driver.
- Scene params in SI units from Open-Meteo (cloud layers, gusts, precipitation split, freezing, hail, grains, rime) with debug presets.
- drei Sky, sky grade, frame-only stars, phased moon; three.quarks precipitation; thunderstorm bolts with cloud flashes; diamond dust.
- Removed legacy simulation config, phase tables and dead WMO helpers.

## 2026-04
- New UI and API data; mobile view, gyroscope parallax, first frost effect; snowflake assets.

## 2026-02 – 2026-03
- Custom weather background engine (tiered clouds, weather effects, lens flare), react-leaflet map picker with a resizable drawer, debug menu and stats; dependency updates and refactors.

## 2025
- Switched from OpenWeatherMap to Open-Meteo; TypeScript migration; Vercel deploy and analytics.

## 2022
- First release (Create React App): search, current weather, weekly forecast.
