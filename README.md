# Yet Another Weather App

Yet another weather app — but with a custom 3D WebGL weather scene, gyroscope parallax on mobile, frost overlays, and interactive weather data. Hover over items to discover tooltips, click the temperature to toggle units, and enjoy the vibes.

Don't get wet — check the weather first!

## Live Demo

[https://yet-another-weather-app-two.vercel.app](https://yet-another-weather-app-two.vercel.app)

## Features

- **City search** — worldwide geocoding with result ranking (capitals and large cities preferred) and browser-language + English fallback so names like "Warszawa" or "Waszyngton" resolve correctly
- **Geolocation** — fetch weather for your current location via the browser Geolocation API
- **Map picker** — resizable drawer with an interactive Leaflet/OpenStreetMap map; click to pick a location, confirm to load weather for that point
- **Current conditions** — temperature, feels like, min/max, wind speed, pressure, humidity, sunrise/sunset, and weather description with icon
- **Live date & time** — day, date, full month, year, and time in the forecast location's timezone, synced every second with a blinking colon
- **7-day forecast** — weekly outlook displayed as interactive cards
- **Unit toggle** — switch between Metric (°C, km/h) and Imperial (°F, mph) by clicking the temperature
- **Weather-driven 3D scene** — custom Three.js scene (sky gradients, sun/moon with lens flare, clouds, rain, snow, fog, mist, stars at night, thunderstorm with lightning) driven by live weather data
- **Gyroscope parallax** — on mobile devices, the camera responds to device tilt via the gyroscope; on desktop, camera follows mouse movement; iOS permission is requested automatically on first tap
- **Frost overlay** — when temperature drops below 0 °C, frost PNG textures appear on all four screen edges with a smooth fade-in transition
- **Responsive mobile layout** — sticky search bar with backdrop blur, scrollable weather content, single-column layout
- **Toast notifications** — error and info messages via react-toastify instead of browser alerts
- **Tooltips** — follow cursor on hover with dynamic text (e.g. "Click to switch to Fahrenheit")
- **Loading state** — animated loader with minimum 500 ms display time, content blur animation while loading
- **Glassmorphism UI** — frosted-glass panels with backdrop blur
- **Dynamic text color** — CSS variable (`--app-text-color`) switches between day/night palettes based on time of day
- **Debug menu (F7)** — override effect type, intensity, time of day, cloud cover, fog density, wind, particles, thunderstorm flag, and more; free camera mode (**C**) with WASD + mouse orbit

## How the Weather Scene Works

- **Rain vs drizzle** — Rain falls quickly in straight or slightly slanted streaks. Drizzle is finer and softer, creating a misty feeling.
- **Snow** — Snowflakes fall slowly and gently sway side to side, drifting and floating.
- **Wind** — Stronger wind tilts rain and pushes snow and mist sideways. Clouds drift with the wind, biased toward the upwind direction for natural spawning.
- **Fog and mist** — Fog fades distant parts of the scene into soft gray, thickening with humidity. Mist is lighter and more transparent.
- **Clouds** — Multi-tiered (low/mid/high) clouds move across the sky responding to wind direction and speed. Spawn bounds dynamically scale with camera aspect ratio for correct coverage on any screen size.
- **Thunderstorms** — Heavy rain, darker sky, and bright lightning flashes with double-flash timing.
- **Frost** — Below 0 °C, frost textures appear on all four screen edges — left, right, top, and bottom.
- **Sun and moon** — Position driven by actual sunrise/sunset times. Sun includes a multi-sample lens flare that hides behind clouds via raycasting.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Create React App |
| Styling | Sass (SCSS) |
| Weather API | [Open-Meteo](https://open-meteo.com/) (free, no API key required) |
| Geocoding | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) |
| 3D Scene | Three.js, React Three Fiber, @react-three/drei |
| Maps | React Leaflet + OpenStreetMap |
| Date/Time | Luxon |
| Icons | react-icons |
| Tooltips | react-tooltip |
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
| `npm start` | Run the development server |
| `npm run build` | Create a production build |

## Project Structure

```
src/
├── components/
│   ├── navbar/              # Search bar, geolocation, map picker trigger
│   ├── weather/
│   │   ├── current/         # Current weather display
│   │   └── weekly/          # 7-day forecast cards
│   ├── map-picker/          # Resizable drawer with Leaflet map
│   ├── weather-scene/       # Container: mounts 3D scene + frost overlay
│   └── debug-menu/          # F7 overlay for simulation overrides
├── weather-scene/
│   ├── scene/               # CameraRig, useDeviceOrientation, SkyBackground, DebugBox, FreeCameraWASD
│   ├── effects/             # CelestialBodies, CloudEffect, Rain, Snow, Mist, Fog, Lightning
│   │   └── clouds/          # Cloud builder, tiers, spawning, color, constants
│   ├── physics/             # Wind and weather physics helpers
│   ├── cameraFrustum.ts     # Frustum-based spawn bounds calculation
│   └── WeatherScene.tsx     # R3F Canvas and scene composition
├── weather/                 # Config, types, sun progress, weather codes
├── services/                # API calls, geocoding, data formatting, error types
├── App.tsx                  # Root component, state management
├── index.tsx                # Entry point
└── index.scss               # Global styles, frost overlay, mobile layout
```

## API

This app uses the [Open-Meteo API](https://open-meteo.com/) — a free, open-source weather API that requires no API key or registration. No environment variables are needed.
