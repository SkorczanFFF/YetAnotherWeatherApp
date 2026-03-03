# Yet Another Weather App

Yet another weather app — but with a fresh-looking UI, animated WebGL cloud background, and interactive weather data. Desktop-focused for now. Hover over items to discover tooltips, click the temperature to toggle units, and enjoy the vibes.

Don't get wet — check the weather first!

## Live Demo

[https://skorczanfff.github.io/YetAnotherWeatherApp/](https://skorczanfff.github.io/YetAnotherWeatherApp/)

## Features

- **City search** — look up weather by city name; worldwide geocoding with result ranking (capitals and large cities preferred) and browser-language + English fallback so names like "Warszawa" or "Waszyngton" resolve correctly
- **Geolocation** — fetch weather for your current location via the browser Geolocation API
- **Current conditions** — temperature, feels like, min/max, wind speed, pressure, humidity, sunrise/sunset, and weather description with icon
- **Live date & time** — day name, date, full month, year, and time in the forecast location's timezone, synced every second with a blinking colon
- **7-day forecast** — weekly outlook displayed as interactive cards with 3D hover effects
- **Unit toggle** — switch between Metric (°C, km/h) and Imperial (°F, mph) by clicking the temperature; tooltip and ARIA label indicate the switch
- **Weather-driven background** — custom Three.js scene (sky, clouds, rain, snow, fog, stars at night, thunderstorm) driven by live weather data; camera parallax on mouse move
- **Tooltips** — follow cursor on hover, hide after 500 ms on leave, high z-index; dynamic text for unit toggle (e.g. "Click to switch to Fahrenheit")
- **Loading state** — animated loader (centered, accent color), minimum 500 ms display time (or longer if needed), content blur animation while loading
- **Glassmorphism UI** — frosted-glass panels with backdrop blur
- **Dynamic text color** — all key text colors come from a CSS variable (`--app-text-color`) that switches between day/night palettes based on the simulated time of day
- **Debug menu (F7)** — override effect type, intensity, time of day, cloud cover (0–1), fog density, wind, particles, thunderstorm flag, and more; fog is visible when "fog" is selected; app title shows "DEBUG" when any override is active; free camera mode (C) lets you fly the camera with WASD and mouse orbit to inspect cloud spawn/delete regions
- **Accessibility** — ARIA attributes, keyboard-navigable unit toggle

## How the weather scene behaves

- **Rain vs drizzle**: Rain falls quickly in straight or slightly slanted streaks. Drizzle looks finer and softer, so the scene feels “misty” rather than stormy.
- **Snow**: Snowflakes fall more slowly than rain and gently sway from side to side, so they drift and float instead of shooting straight down.
- **Wind**: Stronger wind tilts rain and pushes snow and mist sideways, but snow still feels lighter and less “pushed” than rain.
- **Fog and mist**: Fog makes distant parts of the scene fade into a soft gray, and high humidity makes fog appear thicker. Mist is lighter and lets more of the background show through.
- **Clouds**: Clouds move slowly across the sky and respond to wind, but they appear to glide more gently than rain or snow because they are “higher up”.
- **Thunderstorms**: Heavy rain, darker sky, and occasional bright flashes simulate lightning during stormy conditions.
- **Cold vibe**: On cold days, a subtle frost texture appears over the scene, giving the glass panels and background a chilly feeling.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Create React App |
| Styling | Sass (SCSS) |
| Weather API | [Open-Meteo](https://open-meteo.com/) (free, no API key required) |
| Geocoding | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) |
| 3D Background | Three.js, React Three Fiber, @react-three/drei (e.g. Stars) |
| Date/Time | Luxon |
| Icons | react-icons (Weather Icons set) |
| Tooltips | react-tooltip |
| Analytics | Vercel Analytics |
| Deployment | GitHub Pages (gh-pages) |

## Prerequisites

- **Node.js** 24.x (matches the Vercel deployment target; use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to match)
- A WebGL-capable browser and GPU (GTX 550 Ti equivalent or better recommended)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/skorczanfff/YetAnotherWeatherApp.git
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
| `npm test` | Run tests with Jest and React Testing Library |

## Project Structure

```
src/
├── components/
│   ├── navbar/          # Search bar and geolocation button
│   ├── weather/
│   │   ├── current/     # Current weather display
│   │   └── weekly/      # 7-day forecast cards
│   ├── weather-scene/   # Three.js scene container (sky, particles, fog, stars, debug)
│   ├── debug-menu/      # F7 overlay: effect type, intensity, cloud cover, fog, wind, etc.
│   └── footer/          # Footer with attribution
├── weather-scene/       # 3D scene: SkyBackground, FogEffect, CloudEffect, Rain/Snow/Mist, Stars, CameraRig
├── weather-simulation/  # Bounds, camera frustum, physics helpers
├── services/
│   └── weatherService.ts  # API calls, data formatting, geocoding
├── types/
│   └── weather.ts       # TypeScript interfaces (WeatherData, Units, etc.)
├── App.tsx              # Root component, state, WeatherScene, DebugMenu
├── index.tsx            # Entry point
└── index.scss           # Global styles and fonts
```

## API

This app uses the [Open-Meteo API](https://open-meteo.com/) — a free, open-source weather API that requires no API key or registration. No environment variables are needed to run the project.
