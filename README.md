# Yet Another Weather App

Yet another weather app — but with a fresh-looking UI, animated WebGL cloud background, and interactive weather data. Desktop-focused for now. Hover over items to discover tooltips, click the temperature to toggle units, and enjoy the vibes.

Don't get wet — check the weather first!

## Live Demo

[https://skorczanfff.github.io/YetAnotherWeatherApp/](https://skorczanfff.github.io/YetAnotherWeatherApp/)

## Features

- **City search** — look up weather by city name
- **Geolocation** — fetch weather for your current location via the browser Geolocation API
- **Current conditions** — temperature, feels like, min/max, wind speed, pressure, humidity, sunrise/sunset, and weather description with icon
- **7-day forecast** — weekly outlook displayed as interactive cards with 3D hover effects
- **Unit toggle** — switch between Metric (°C, km/h) and Imperial (°F, mph) by clicking the temperature
- **Weather-driven background** — custom Three.js scene (sky, rain, snow, fog, thunderstorm) driven by live weather data; camera parallax on mouse move
- **Glassmorphism UI** — frosted-glass panels with backdrop blur
- **Tooltips** — contextual info on hover for weather metrics
- **Debug menu (F7)** — override scene parameters; app title shows "DEBUG" when any override is active
- **Accessibility** — ARIA attributes, keyboard-navigable unit toggle

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Create React App |
| Styling | Sass (SCSS) |
| Weather API | [Open-Meteo](https://open-meteo.com/) (free, no API key required) |
| Geocoding | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) |
| 3D Background | Three.js (custom weather scene) |
| Date/Time | Luxon |
| Icons | react-icons (Weather Icons set) |
| Tooltips | react-tooltip |
| Analytics | Vercel Analytics |
| Deployment | GitHub Pages (gh-pages) |

## Prerequisites

- **Node.js** 22.19.0 (see `.nvmrc`; use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to match)
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
│   ├── weather-scene/   # Three.js weather-driven background (sky, particles, fog)
│   ├── debug-menu/      # F7 overlay to override scene parameters
│   └── footer/          # Footer with attribution
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
