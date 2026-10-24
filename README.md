# Yet Another Weather App

Yet another weather app — but the background is a live 3D sky computed from the forecast: volumetric clouds from the model's cloud layers and atmosphere, real sun and moon positions, rain, snow, hail, lightning and frost on the glass. Liquid-glass UI that adapts to how bright the sky is.

Don't get wet — check the weather first!

## Live Demo

[https://www.yet-another-weather-app.skoftware.pl](https://www.yet-another-weather-app.skoftware.pl) (mirror: [yet-another-weather-app.vercel.app](https://yet-another-weather-app.vercel.app))

## Features

- **City search** — worldwide geocoding (Open-Meteo); matches are ranked capitals first, then regional capitals, then by population. The search runs in the browser's language and falls back to English when that finds nothing, so local names like "Warszawa" or "Waszyngton" resolve too. The app opens on Katowice
- **Geolocation** — weather for your current location via the browser Geolocation API; the place name comes from Nominatim reverse geocoding
- **Map picker** — resizable drawer with a Leaflet/OpenStreetMap map (a full-width sheet on narrow phones); click to drop a pin, confirm to load it
- **Current conditions** — condition and icon, temperature, feels like, today's high/low, wind (speed and direction), humidity, pressure, UV index, visibility, cloud cover, precipitation and dew point; a live clock and the sun's arc from sunrise to sunset (the moon's from sunset to sunrise at night), all in the location's time zone
- **Next 12 hours** — temperature chart
- **6-day forecast** — the next six days as tiles with icon, condition, high/low, precipitation chance, max wind with its direction and max UV
- **Unit toggle** — Metric (°C, km/h) or Imperial (°F, mph); pressure (hPa), visibility (km) and precipitation (mm) stay metric
- **Weather-driven 3D scene** — see below
- **Parallax** — the camera shifts slightly with device tilt on phones (iOS asks for permission on the first tap) and with the mouse elsewhere
- **Adaptive liquid glass** — cards darken and firm up their text as the sky behind them brightens; edges light up near the cursor
- **Silent refresh** — data reloads every 15 minutes without a loader; a failed refresh keeps the data on screen
- **Quality tiers** — phones start on `low`, desktops on `high`; the scene steps down (high → medium → low → a flat cloud deck instead of the volumetric clouds) when the frame rate can't keep up
- **Debug menu** — F7 (or 5 quick taps on the footer status on phones): weather presets, time and date, every scene input, cloud physics pins and readout, quality tier and parallax pins, perf readout, forced lightning

## How the Weather Scene Works

- **Clouds** — a raymarched volumetric layer whose base, top, cover, type (stratus → cumulus → cumulonimbus) and density come from the forecast: temperature and dew point, boundary layer height, CAPE and lifted index, cloud cover and height per pressure level, and measured sunlight. A mid-level layer shows as a thin sheet above a low deck, cirrus as a separate high layer; no layer is drawn above the measured total cover. Low and mid clouds drift with the 850 hPa wind, cirrus with the 300 hPa wind (sped up, as a time-lapse).
- **Sun and moon** — real positions (suncalc), squeezed into the frame so they stay visible: on wide screens they travel in the margins beside the cards (morning on the left, afternoon on the right). The moon shows its real phase, lit on the side facing the sun. Cloud undersides glow red at sunset; stars come out at night.
- **Light** — god rays through gaps in the cloud when the sun is near the frame, a glow round the sun, and a lens flare (from a bright moon too) that cloud in front puts out.
- **Precipitation** — rain, drizzle, freezing rain, snow, sleet (rain with wet snow), snow grains and hail, with rates from the forecast; gusty wind slants rain and pushes snow, showers come in pulses.
- **Thunderstorms** — lightning bolts that light up the cloud they strike from.
- **Fog and haze** — from the reported visibility: horizon haze, and fog under 1 km.
- **Frost** — the window frosts from the edges, gradually from 0 °C to −20 °C (more in humid air), and glazes under freezing rain or rime fog.
- **Diamond dust** — sparkling ice crystals in very cold (≤ −10 °C), mostly clear, humid air with nothing falling.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 + TypeScript 7 |
| Build | Vite 8 |
| Styling | Sass (SCSS); Chakra Petch + Geist Mono (Google Fonts) |
| Weather API | [Open-Meteo](https://open-meteo.com/) (free, no API key required) |
| Geocoding | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), Nominatim (reverse) |
| 3D Scene | Three.js, React Three Fiber, @react-three/drei, three.quarks (particles), suncalc; own GLSL shaders (volumetric clouds, sky, frost) |
| Maps | React Leaflet + OpenStreetMap |
| Date/Time | Luxon |
| Icons | Own line-art SVG (`components/icons.tsx`) |
| Notifications | react-toastify (invalid city name, geolocation errors) |
| Analytics | Vercel Analytics |
| Deployment | Vercel |

## Prerequisites

- **Node.js** 24 (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to match)
- **pnpm** 12 (`corepack enable pnpm` picks the version pinned in `packageManager`)
- A WebGL-capable browser

## Getting Started

```bash
# Clone the repository
git clone https://github.com/SkorczanFFF/YetAnotherWeatherApp.git
cd YetAnotherWeatherApp

# Install dependencies
pnpm install

# Start the development server
pnpm start
```

The dev server opens [http://localhost:3000](http://localhost:3000) in the browser.

## Available Scripts

| Script | Description |
|---|---|
| `pnpm start` / `pnpm dev` | Run the development server |
| `pnpm build` | Type-check and create a production build in `build/` |
| `pnpm preview` | Serve the production build |

## Project Structure

```
src/
├── App.tsx                # Top-level state and layout
├── hooks/                 # useWeather (fetch + refresh), useDebugToggle, useGlassSpotlight, useLiveClock, useDialogFocus
├── services/              # Open-Meteo forecast, geocoding (Open-Meteo + Nominatim), API → app data mapping
├── weather/               # Domain: WMO codes, units, scene parameters, precipitation, fog, frost, cloud physics, debug overrides, presets
├── utils/                 # Display formatting, math helpers
├── components/            # UI: navbar, current/hourly/weekly cards, map picker, loaders, debug menu, icons
├── styles/                # Liquid-glass and token SCSS
└── weather-scene/
    ├── WeatherSceneContainer.tsx  # Error boundary around the scene
    ├── WeatherScene.tsx   # R3F canvas, quality tiers, layer mount order
    ├── core/              # World frame, view volumes, per-frame signals, scene driver, sun/moon placement, sky light, camera, quality, palette
    ├── layers/            # Sky, sun glow, stars, moon, clouds/, cloud deck, precip/, thunder, lens flare, frost, diamond dust
    ├── shaders/           # GLSL (clouds/ holds the volumetric passes)
    └── debug/             # Perf probe
```

More detail for contributors (and AI agents) is in `CLAUDE.md`; the history is in `CHANGELOG.md`.

## API

This app uses the [Open-Meteo API](https://open-meteo.com/) — a free, open-source weather API that requires no API key or registration. No environment variables are needed.
