# Yet Another Weather App

Yet another weather app — but the background is a live 3D sky computed from the forecast: volumetric clouds from the model's cloud layers and atmosphere, real sun and moon positions, rain, snow, hail, lightning and frost on the glass. Liquid-glass UI that adapts to how bright the sky is.

Don't get wet — check the weather first!

## Live Demo

[https://yet-another-weather-app-two.vercel.app](https://yet-another-weather-app-two.vercel.app)

## Features

- **City search** — worldwide geocoding with result ranking (capitals and large cities preferred) and browser-language + English fallback, so names like "Warszawa" or "Waszyngton" resolve correctly
- **Geolocation** — weather for your current location via the browser Geolocation API
- **Map picker** — resizable drawer with a Leaflet/OpenStreetMap map; click to pick a point, confirm to load it
- **Current conditions** — temperature, feels like, min/max, wind, pressure, humidity, visibility, cloud cover, UV, precipitation, dew point, and the sun (or moon) arc between sunrise and sunset, all in the location's time zone
- **Next 12 hours** — temperature chart
- **6-day forecast** — tiles with icon, min/max, precipitation chance, wind and UV
- **Unit toggle** — Metric (°C, km/h) or Imperial (°F, mph)
- **Weather-driven 3D scene** — see below
- **Parallax** — the camera follows device tilt on phones (iOS asks for permission on first tap) and the mouse on desktop
- **Adaptive liquid glass** — cards darken and firm up their text as the sky behind them brightens; edges light up near the cursor
- **Silent refresh** — data reloads every 15 minutes without a loader
- **Quality tiers** — the scene steps down (high → medium → low → a flat cloud deck) when the frame rate can't keep up
- **Debug menu** — F7 (or 5 quick taps on the footer status on phones): weather presets, time, every scene input, cloud physics, quality tier, perf readout, forced lightning

## How the Weather Scene Works

- **Clouds** — a raymarched volumetric layer whose base, top, cover, type (stratus → cumulus → cumulonimbus) and density come from the forecast: dew point, boundary layer, CAPE, cloud cover per pressure level and measured sunlight. Cirrus is a separate high layer. Low and high clouds drift with the 850 hPa and 300 hPa winds.
- **Sun and moon** — real positions (suncalc), squeezed into the frame so they stay visible; the moon shows its real phase. Clouds glow red at sunset.
- **Precipitation** — rain, drizzle, freezing rain, snow, wet snow, snow grains and hail, with rates from the forecast; wind slants rain and pushes snow, showers come in pulses.
- **Thunderstorms** — lightning bolts that light up the cloud they strike from.
- **Fog and haze** — from the reported visibility.
- **Frost** — the window frosts gradually from 0 °C to −20 °C (more in humid air), and glazes under freezing rain or rime fog.
- **Diamond dust** — sparkling ice crystals in very cold, clear, humid air.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Sass (SCSS) |
| Weather API | [Open-Meteo](https://open-meteo.com/) (free, no API key required) |
| Geocoding | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), Nominatim (reverse) |
| 3D Scene | Three.js, React Three Fiber, @react-three/drei, three.quarks (particles), suncalc |
| Maps | React Leaflet + OpenStreetMap |
| Date/Time | Luxon |
| Icons | Own line-art SVG (`components/icons.tsx`) |
| Notifications | react-toastify |
| Analytics | Vercel Analytics |
| Deployment | Vercel |

## Prerequisites

- **Node.js** 24 (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to match)
- A WebGL-capable browser

## Getting Started

```bash
# Clone the repository
git clone https://github.com/SkorczanFFF/YetAnotherWeatherApp.git
cd YetAnotherWeatherApp

# Install dependencies
npm install

# Start the development server
npm start
```

The app opens at [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|---|---|
| `npm start` / `npm run dev` | Run the development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Serve the production build |

## Project Structure

```
src/
├── App.tsx                # Top-level state and layout
├── hooks/                 # useWeather (fetch + refresh), useDebugToggle, useGlassSpotlight
├── services/              # Open-Meteo forecast + geocoding calls, API → app data mapping
├── weather/               # Domain: WMO codes, units, scene parameters, cloud physics, debug overrides, presets
├── utils/                 # Display formatting, math helpers
├── components/            # UI: navbar, current/hourly/weekly cards, map picker, loaders, debug menu, icons
├── styles/                # Liquid-glass and token SCSS
└── weather-scene/
    ├── WeatherScene.tsx   # R3F canvas, quality tiers, layer mount order
    ├── core/              # World frame, view volumes, per-frame signals, scene driver, palette, constants
    ├── layers/            # Sky, stars, moon, clouds/, cloud deck, precip/, thunder, frost, diamond dust
    └── shaders/           # GLSL
```

More detail for contributors (and AI agents) is in `CLAUDE.md`; the history is in `CHANGELOG.md`.

## API

This app uses the [Open-Meteo API](https://open-meteo.com/) — a free, open-source weather API that requires no API key or registration. No environment variables are needed.
