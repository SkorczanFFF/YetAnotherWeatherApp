# Comprehensive Code Review - YetAnotherWeatherApp

**Review Date:** February 2026
**Reviewer:** Senior Developer Code Audit
**Severity Levels:** 🔴 Critical | 🟠 Major | 🟡 Minor | 🔵 Info

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [Code Duplication & Redundancy](#2-code-duplication--redundancy)
3. [Outdated Dependencies](#3-outdated-dependencies)
4. [Dead Code & Unused Resources](#4-dead-code--unused-resources)
5. [Type Safety Issues](#5-type-safety-issues)
6. [Performance & Efficiency](#6-performance--efficiency)
7. [Code Quality & Best Practices](#7-code-quality--best-practices)
8. [Testing Issues](#8-testing-issues)
9. [Security Concerns](#9-security-concerns)
10. [SCSS/Styling Issues](#10-scssstyling-issues)
11. [Configuration Issues](#11-configuration-issues)
12. [Accessibility Issues](#12-accessibility-issues)

---

## 1. Critical Issues

### 🔴 1.1 Component Named Incorrectly in Footer.tsx

**File:** `src/components/footer/Footer.tsx:4,12`

**Issue:** The Footer component is exported with the wrong name `Navbar`.

```typescript
// Current (WRONG)
const Navbar = () => {
  return (
    <footer className='footer'>
      ...
    </footer>
  )
}
export default Navbar
```

**Proposed Fix:**
```typescript
const Footer: React.FC = () => {
  return (
    <footer className='footer'>
      <a href="https://mskorus.pl/" className='footer-a'>&copy; Maciej Skorus</a>
    </footer>
  )
}
export default Footer
```

---

### 🔴 1.2 Unused Props in Navbar Component

**File:** `src/components/navbar/Navbar.tsx:20`

**Issue:** Props `units` and `setUnits` are passed to Navbar but never used.

```typescript
const Navbar: React.FC<NavbarProps> = ({ setQuery, units, setUnits }) => {
  // units and setUnits are NEVER used in this component
```

**Proposed Fix:** Either remove these props from the interface and component:
```typescript
interface NavbarProps {
  setQuery: (query: WeatherQuery) => void;
  // Remove: units: Units;
  // Remove: setUnits: (units: Units) => void;
}

const Navbar: React.FC<NavbarProps> = ({ setQuery }) => {
```

And update App.tsx:
```typescript
<Navbar setQuery={setQuery} />
```

---

### 🔴 1.3 react-toastify Installed but Never Used

**File:** `package.json:23`

**Issue:** The package `react-toastify` is installed but never imported or used anywhere in the codebase.

**Proposed Fix:** Remove the dependency:
```bash
npm uninstall react-toastify
```

---

### 🔴 1.4 gsap Installed but Never Used

**File:** `package.json:16`

**Issue:** GSAP animation library is installed but never imported or used.

**Proposed Fix:** Remove the dependency:
```bash
npm uninstall gsap
```

---

## 2. Code Duplication & Redundancy

### 🟠 2.1 Duplicated `WeatherQuery` Interface

**Files:**
- `src/App.tsx:11-15`
- `src/components/navbar/Navbar.tsx:6-10`

**Issue:** Identical interface defined in two files.

```typescript
// Both files have:
interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}
```

**Proposed Fix:** Create a shared types file:
```typescript
// src/types/weather.ts
export interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}

export type Units = "metric" | "imperial";

export interface WeatherData {
  dt: number;
  timezone: string;
  name: string;
  country: string;
  temp: number;
  temp_max: number;
  temp_min: number;
  pressure: number;
  feels_like: number;
  sunrise: number;
  sunset: number;
  humidity: number;
  speed: number;
  details: string;
  icon: string;
  daily: DailyWeather[];
}

export interface DailyWeather {
  title: string;
  temp: number;
  temp_min: number;
  icon: string;
}
```

Then import from this file in all components.

---

### 🟠 2.2 Duplicated `Units` Type

**Files:**
- `src/App.tsx:21`
- `src/components/navbar/Navbar.tsx:12`
- `src/components/weather/weekly/WeeklyForecast.tsx:12`

**Issue:** Same type defined in 3 different places.

**Proposed Fix:** Export from shared types file (see 2.1 above).

---

### 🟠 2.3 Duplicated `WeatherData` Interface

**Files:**
- `src/App.tsx:23-45`
- `src/components/weather/current/CurrentWeather.tsx:19-35`

**Issue:** Nearly identical interfaces with slight differences.

**Proposed Fix:** Consolidate into shared types file and export from weatherService.ts.

---

### 🟠 2.4 Duplicated `DailyWeather` Interface

**Files:**
- `src/services/weatherService.ts:78-83`
- `src/components/weather/weekly/WeeklyForecast.tsx:5-10`

**Issue:** Same interface defined twice.

**Proposed Fix:** Export from weatherService.ts and import in WeeklyForecast.tsx:
```typescript
// In weatherService.ts - already defined, just export it
export interface DailyWeather {
  title: string;
  temp: number;
  temp_min: number;
  icon: string;
}

// In WeeklyForecast.tsx
import { iconUrlFromCode, DailyWeather } from "../../../services/weatherService";
```

---

### 🟠 2.5 Repeated Unit Suffix Logic

**File:** `src/components/weather/current/CurrentWeather.tsx`

**Issue:** The pattern `units === "metric" ? "°C" : "°F"` and similar are repeated 6+ times.

```typescript
// Repeated throughout:
{`${weather.temp.toFixed()}°${units === "metric" ? "C" : "F"}`}
{`${weather.speed.toFixed()} ${units === "metric" ? "km/h" : "mph"}`}
```

**Proposed Fix:** Create helper functions:
```typescript
const getTemperatureUnit = (units: Units): string => units === "metric" ? "C" : "F";
const getSpeedUnit = (units: Units): string => units === "metric" ? "km/h" : "mph";

const formatTemperature = (value: number, units: Units): string =>
  `${value.toFixed()}°${getTemperatureUnit(units)}`;

const formatSpeed = (value: number, units: Units): string =>
  `${value.toFixed()} ${getSpeedUnit(units)}`;
```

---

### 🟠 2.6 Repetitive ReactTooltip Components

**File:** `src/components/weather/current/CurrentWeather.tsx:74-208`

**Issue:** 8 nearly identical ReactTooltip components with the same props.

```typescript
// This pattern is repeated 8 times:
<ReactTooltip
  id="..."
  place="bottom"
  type="light"
  effect="float"
  className="tooltip"
  afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
>
  <span>...</span>
</ReactTooltip>
```

**Proposed Fix:** Create a reusable tooltip wrapper:
```typescript
interface WeatherTooltipProps {
  id: string;
  content: string;
}

const WeatherTooltip: React.FC<WeatherTooltipProps> = ({ id, content }) => (
  <ReactTooltip
    id={id}
    place="bottom"
    type="light"
    effect="float"
    className="tooltip"
    afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
  >
    <span>{content}</span>
  </ReactTooltip>
);

// Usage:
<WeatherTooltip id="wind" content="Wind strength" />
```

---

### 🟠 2.7 Duplicate Font Import

**Files:**
- `public/index.html:14-19` (Chakra Petch)
- `src/index.scss:1` (Noto Sans)

**Issue:** Google Fonts imported in two different places, and both fonts are listed in the body font-family.

**Proposed Fix:** Consolidate font imports in index.html only and remove from index.scss:
```html
<!-- index.html -->
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Noto+Sans:wght@200;300;400;500;700&display=swap" rel="stylesheet" />
```

```scss
// index.scss - Remove the @import line
// @import url("https://fonts.googleapis.com/css2?family=Noto+Sans...");
```

---

### 🟠 2.8 Similar 3D Perspective Transforms in SCSS

**Files:**
- `src/components/weather/current/CurrentWeather.scss:51,83`
- `src/components/weather/weekly/WeeklyForecast.scss:58-68`

**Issue:** Nearly identical 3D transforms defined multiple times.

```scss
// Repeated pattern:
transform: perspective(900px) rotateY(20deg);
&:hover {
  transform: perspective(900px) rotateY(0deg);
}
```

**Proposed Fix:** Create a shared SCSS mixin:
```scss
// src/styles/_mixins.scss
@mixin perspective-tilt($angle) {
  transform: perspective(900px) rotateY($angle);
  transition: 0.25s ease-in-out;
  &:hover {
    transform: perspective(900px) rotateY(0deg);
  }
}

// Usage:
.left-wing .wing-item {
  @include perspective-tilt(20deg);
}
.right-wing .wing-item {
  @include perspective-tilt(-20deg);
}
```

---

## 3. Outdated Dependencies

### 🔴 3.1 react-tooltip (BREAKING CHANGES)

**Current:** `^4.2.21`
**Latest:** `5.30.0`

**Impact:** v5 has completely different API. Current usage of `ReactTooltip.rebuild()` and `ReactTooltip.hide()` won't work.

**Proposed Fix:** Either update and refactor:
```bash
npm install react-tooltip@latest
```

Then update usage (v5 syntax):
```typescript
import { Tooltip } from 'react-tooltip';

// v5 doesn't need ReactTooltip.rebuild() - handles this automatically
<div data-tooltip-id="my-tooltip" data-tooltip-content="Hello!">
  ◕‿‿◕
</div>
<Tooltip id="my-tooltip" />
```

---

### 🔴 3.2 TypeScript

**Current:** `^4.9.5`
**Latest:** `5.9.3`

**Proposed Fix:**
```bash
npm install typescript@latest
```

---

### 🟠 3.3 luxon and @types/luxon

**Current:** `^2.4.0`
**Latest:** `3.x`

**Proposed Fix:**
```bash
npm install luxon@latest @types/luxon@latest
```

---

### 🟠 3.4 react-toastify (if keeping)

**Current:** `^9.0.2`
**Latest:** `11.0.5`

**Note:** Since it's unused, recommend removal instead.

---

### 🟠 3.5 sass

**Current:** `^1.49.11`
**Latest:** `1.97.2`

**Proposed Fix:**
```bash
npm install sass@latest
```

---

### 🟠 3.6 three and @types/three

**Current:** `^0.139.2` / `^0.139.0`
**Latest:** `0.182.0`

**Proposed Fix:**
```bash
npm install three@latest @types/three@latest
```

**Note:** Check compatibility with vanta.js before updating.

---

### 🟠 3.7 gsap (if keeping)

**Current:** `^3.10.4`
**Latest:** `3.14.2`

**Note:** GSAP is now 100% FREE including all premium plugins! But since it's unused, recommend removal.

---

### 🟠 3.8 react-icons

**Current:** `^4.3.1`
**Latest:** Check npm for current version

**Proposed Fix:**
```bash
npm install react-icons@latest
```

---

### 🟠 3.9 gh-pages

**Current:** `^4.0.0`
**Latest:** Check npm for current version

**Proposed Fix:**
```bash
npm install gh-pages@latest --save-dev
```

---

## 4. Dead Code & Unused Resources

### 🔴 4.1 Console Logs Throughout Codebase

**Files:**
- `src/App.tsx:55,59,61`
- `src/services/weatherService.ts:110,134,144,155,159,223,323,337`
- `src/components/navbar/Navbar.tsx:34,39`
- `src/components/weather/weekly/WeeklyForecast.tsx:20`

**Issue:** Production code contains debug console.log statements.

**Proposed Fix:** Remove all console.log statements or replace with a proper logging utility that can be disabled in production:

```typescript
// src/utils/logger.ts
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => isDevelopment && console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => isDevelopment && console.warn(...args),
};
```

---

### 🟠 4.2 Empty _colors.scss File

**File:** `src/components/_colors.scss`

**Issue:** File exists but is completely empty.

**Proposed Fix:** Either populate with color variables or delete:
```scss
// If keeping, add project colors:
$primary-blue: #72c5e9;
$dark-blue: #000e3d9d;
$light-blue: #5bb4d7;
$cloud-color: #b5c1e1;
$sun-color: #f29c30;
$text-color: #000e3d9d;
```

Or delete the file if not needed.

---

### 🟠 4.3 Compiled CSS Files in Source Control

**Files:**
- `src/index.css`
- `src/index.css.map`
- `src/index.min.css`

**Issue:** Compiled CSS files shouldn't be in source control - they should be generated during build.

**Proposed Fix:** Add to `.gitignore` and delete:
```gitignore
# Add to .gitignore
*.css.map
src/index.css
src/index.min.css
```

```bash
git rm src/index.css src/index.css.map src/index.min.css
```

---

### 🟠 4.4 Potentially Unused noise.png Asset

**File:** `src/assets/noise.png`

**Issue:** Asset file exists but no reference found in any component or SCSS file.

**Proposed Fix:** Verify if used, if not, delete:
```bash
rm src/assets/noise.png
```

---

### 🟡 4.5 web-vitals Installed but Not Used

**File:** `package.json:28`

**Issue:** The `web-vitals` package is installed but there's no `reportWebVitals` call in index.tsx.

**Proposed Fix:** Either use it or remove it:
```bash
npm uninstall web-vitals
```

Or implement it:
```typescript
// src/index.tsx
import reportWebVitals from './reportWebVitals';
// ...
reportWebVitals(console.log);
```

---

## 5. Type Safety Issues

### 🟠 5.1 Loose Typing in weatherService.ts

**File:** `src/services/weatherService.ts:99`

**Issue:** Uses `Record<string, any>` which bypasses TypeScript safety.

```typescript
const getWeatherData = async (
  endpoint: string,
  searchParams: Record<string, any>  // Too loose
): Promise<any> => {  // Too loose
```

**Proposed Fix:**
```typescript
interface OpenMeteoQueryParams {
  latitude: number;
  longitude: number;
  timezone: string;
  temperature_unit: string;
  wind_speed_unit: string;
  current: string;
  daily: string;
}

const getWeatherData = async (
  endpoint: string,
  searchParams: OpenMeteoQueryParams
): Promise<OpenMeteoResponse> => {
```

---

### 🟠 5.2 Missing Type for Vanta THREE Parameter

**File:** `src/types/vanta.d.ts:16`

**Issue:** THREE parameter is typed as `any`.

```typescript
THREE: any;
```

**Proposed Fix:**
```typescript
import * as THREE from 'three';

THREE: typeof THREE;
```

---

### 🟡 5.3 Missing Footer Component Type

**File:** `src/components/footer/Footer.tsx:4`

**Issue:** Component lacks explicit React.FC type annotation.

```typescript
// Current
const Navbar = () => {

// Should be
const Footer: React.FC = () => {
```

---

## 6. Performance & Efficiency

### 🟠 6.1 Vanta Effect Cleanup Timing Issue

**File:** `src/App.tsx:67-91`

**Issue:** The Vanta effect useEffect has a potential issue where cleanup runs but re-initialization happens due to the dependency array including `vantaEffect`.

```typescript
useEffect(() => {
  if (!vantaEffect) {
    setVantaEffect(CLOUDS({...}));
  }
  return () => {
    if (vantaEffect) vantaEffect.destroy();
  };
}, [vantaEffect]);  // This causes re-run when vantaEffect changes
```

**Proposed Fix:**
```typescript
useEffect(() => {
  const effect = CLOUDS({
    el: "#App",
    // ... options
  });

  return () => {
    effect.destroy();
  };
}, []); // Empty dependency array - run once on mount
```

---

### 🟠 6.2 Weather Fetch on Both Query AND Units Change

**File:** `src/App.tsx:53-65`

**Issue:** Fetching weather data when units change is inefficient - unit conversion could be done client-side.

```typescript
useEffect(() => {
  const fetchWeather = async () => {
    // Fetches from API on both query and units change
  };
  fetchWeather();
}, [query, units]);  // Both dependencies trigger API call
```

**Proposed Fix:** Store weather data in metric, convert on display:
```typescript
// Only fetch on query change
useEffect(() => {
  const fetchWeather = async () => {
    const data = await getFormattedWeatherData({ ...query, units: 'metric' });
    setWeather(data);
  };
  fetchWeather();
}, [query]);

// Convert in display components:
const displayTemp = units === 'imperial'
  ? (weather.temp * 9/5) + 32
  : weather.temp;
```

---

### 🟡 6.3 Unnecessary Re-renders from toFixed() in JSX

**File:** `src/components/weather/current/CurrentWeather.tsx`

**Issue:** Calling `.toFixed()` creates new strings on every render.

```typescript
{weather.speed.toFixed()}
{weather.temp.toFixed()}
```

**Proposed Fix:** Use useMemo or compute once:
```typescript
const formattedValues = useMemo(() => ({
  speed: weather.speed.toFixed(),
  temp: weather.temp.toFixed(),
  // ... etc
}), [weather]);
```

---

## 7. Code Quality & Best Practices

### 🟠 7.1 Unnecessary React Fragments

**Files:**
- `src/components/weather/current/CurrentWeather.tsx:61,213`
- `src/components/weather/weekly/WeeklyForecast.tsx:21,44`

**Issue:** Using `<></>` when there's only one child element.

```typescript
// Current
return (
  <>
    <div className="main-info border">
      ...
    </div>
  </>
);
```

**Proposed Fix:**
```typescript
// Remove unnecessary fragment
return (
  <div className="main-info border">
    ...
  </div>
);
```

---

### 🟠 7.2 Missing Error State Display

**File:** `src/App.tsx`

**Issue:** Errors are logged but never displayed to users.

```typescript
} catch (error) {
  console.error("Error fetching weather:", error);
  // User sees nothing!
}
```

**Proposed Fix:**
```typescript
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFormattedWeatherData({ ...query, units });
      setWeather(data);
    } catch (error) {
      setError('Failed to fetch weather data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  fetchWeather();
}, [query, units]);

// In render:
{loading && <div className="loading">Loading...</div>}
{error && <div className="error">{error}</div>}
{weather && !loading && !error && (
  <>
    <CurrentWeather ... />
    <WeeklyForecast ... />
  </>
)}
```

---

### 🟠 7.3 Missing Geolocation Error Handling

**File:** `src/components/navbar/Navbar.tsx:32-42`

**Issue:** No handling for when user denies location permission.

```typescript
const handleLocation = (): void => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      // Only handles success case
    });
    // No error callback!
  }
};
```

**Proposed Fix:**
```typescript
const handleLocation = (): void => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setQuery({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('Location permission denied. Please enable it in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            alert('Location request timed out.');
            break;
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  } else {
    alert('Geolocation is not supported by your browser.');
  }
};
```

---

### 🟡 7.4 Hardcoded Default City

**File:** `src/App.tsx:48`

**Issue:** Default city is hardcoded.

```typescript
const [query, setQuery] = useState<WeatherQuery>({ q: "katowice" });
```

**Proposed Fix:** Consider using user's location as default, or make configurable:
```typescript
const DEFAULT_CITY = process.env.REACT_APP_DEFAULT_CITY || "katowice";
const [query, setQuery] = useState<WeatherQuery>({ q: DEFAULT_CITY });
```

---

### 🟡 7.5 Magic Numbers in Code

**Files:** Multiple

**Issue:** Magic numbers used without explanation.

```typescript
// App.tsx
minHeight: 850.0,
minWidth: 1150.0,

// CurrentWeather.tsx
afterShow={() => setTimeout(ReactTooltip.hide, 2000)}
```

**Proposed Fix:** Define as constants:
```typescript
const VANTA_CONFIG = {
  MIN_HEIGHT: 850,
  MIN_WIDTH: 1150,
} as const;

const TOOLTIP_HIDE_DELAY_MS = 2000;
```

---

## 8. Testing Issues

### 🔴 8.1 Empty Test Assertion

**File:** `src/App.test.tsx:5-8`

**Issue:** Test renders component but doesn't assert anything.

```typescript
test("renders learn react link", () => {
  render(<App />);
  // Add your test assertions here  <-- Comment says it all
});
```

**Proposed Fix:** Either write proper tests or remove:
```typescript
describe('App', () => {
  test('renders navbar', () => {
    render(<App />);
    expect(screen.getByText(/YET ANOTHER/i)).toBeInTheDocument();
  });

  test('renders search input', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/enter city/i)).toBeInTheDocument();
  });

  test('displays weather data when loaded', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/katowice/i)).toBeInTheDocument();
    });
  });
});
```

---

### 🟠 8.2 Testing Libraries in Dependencies

**File:** `package.json:6-8`

**Issue:** Testing libraries are in `dependencies` instead of `devDependencies`.

```json
"dependencies": {
  "@testing-library/jest-dom": "^5.16.4",
  "@testing-library/react": "^14.2.1",
  "@testing-library/user-event": "^14.5.2",
```

**Proposed Fix:** Move to devDependencies:
```json
"devDependencies": {
  "@testing-library/jest-dom": "^5.16.4",
  "@testing-library/react": "^14.2.1",
  "@testing-library/user-event": "^14.5.2",
  "@types/jest": "^29.5.12",
  "gh-pages": "^4.0.0"
}
```

---

## 9. Security Concerns

### 🟠 9.1 HTTP Instead of HTTPS for Icons

**File:** `src/services/weatherService.ts:394`

**Issue:** Icon URL uses HTTP instead of HTTPS.

```typescript
return `http://openweathermap.org/img/wn/${code}@4x.png`;
```

**Proposed Fix:**
```typescript
return `https://openweathermap.org/img/wn/${code}@4x.png`;
```

---

### 🟡 9.2 No Input Validation for City Search

**File:** `src/components/navbar/Navbar.tsx:23-25`

**Issue:** City input is not sanitized before being used in API calls.

```typescript
const handleSearch = (): void => {
  if (city !== "") setQuery({ q: city });  // No validation
};
```

**Proposed Fix:**
```typescript
const handleSearch = (): void => {
  const trimmedCity = city.trim();
  if (trimmedCity && /^[a-zA-Z\s\-']+$/.test(trimmedCity)) {
    setQuery({ q: trimmedCity });
  }
};
```

---

## 10. SCSS/Styling Issues

### 🟡 10.1 Inconsistent Color Definitions

**Files:** Multiple SCSS files

**Issue:** Same color `#000e3d9d` defined in multiple places without a variable.

**Proposed Fix:** Create and use variables:
```scss
// _colors.scss
$primary-dark: #000e3d9d;
$primary-dark-light: #000e3d77;
$primary-dark-lighter: #000e3d75;

// Usage in other files:
@import '../_colors.scss';
.search-button {
  background: $primary-dark;
}
```

---

### 🟡 10.2 Unused CSS Classes

**File:** `src/components/weather/weekly/WeeklyForecast.scss:64-68`

**Issue:** `.atom-right` class is defined but only `.atom-left` is used in the component.

```typescript
// WeeklyForecast.tsx - only uses atom-left
<div key={index} className="atom atom-left border-light">
```

**Proposed Fix:** Either remove unused class or implement alternating transforms:
```typescript
<div
  key={index}
  className={`atom ${index < 3 ? 'atom-left' : index > 3 ? 'atom-right' : ''} border-light`}
>
```

---

### 🟡 10.3 Commented Out CSS

**File:** `src/components/weather/current/CurrentWeather.scss:61`

**Issue:** Commented code left in stylesheet.

```scss
.main-middle-info {
  //padding: 0 2rem;  <-- Should be removed
```

**Proposed Fix:** Remove commented code.

---

## 11. Configuration Issues

### 🟡 11.1 Missing TypeScript Strict Options

**File:** `tsconfig.json`

**Issue:** Some useful strict options are not enabled.

**Proposed Fix:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

### 🟡 11.2 Missing .env.example File

**Issue:** No documentation for environment variables.

**Proposed Fix:** Create `.env.example`:
```env
# Default city for weather app
REACT_APP_DEFAULT_CITY=katowice
```

---

## 12. Accessibility Issues

### 🟠 12.1 Empty Alt Attributes on Images

**Files:**
- `src/components/weather/current/CurrentWeather.tsx:137`
- `src/components/weather/weekly/WeeklyForecast.tsx:32`

**Issue:** Images have empty alt attributes.

```typescript
<img src={iconUrlFromCode(weather.icon)} alt="" className="weather-icon" />
```

**Proposed Fix:**
```typescript
<img
  src={iconUrlFromCode(weather.icon)}
  alt={`Weather icon showing ${weather.details}`}
  className="weather-icon"
/>
```

---

### 🟠 12.2 Non-Semantic Click Handlers on Divs

**File:** `src/components/navbar/Navbar.tsx:52,62`

**Issue:** Clickable divs without proper keyboard accessibility.

```typescript
<div className="location-icon-container" onClick={handleLocation}>
<div className="search-button" onClick={handleSearch}>
```

**Proposed Fix:** Use buttons:
```typescript
<button
  type="button"
  className="location-icon-container"
  onClick={handleLocation}
  aria-label="Use my location"
>
  <IoLocationSharp className="location-icon" />
</button>
<button
  type="submit"
  className="search-button"
  aria-label="Search"
>
  <BsSearch />
</button>
```

---

### 🟡 12.3 Missing Main Landmark

**File:** `src/App.tsx`

**Issue:** No `<main>` element for accessibility.

**Proposed Fix:**
```typescript
return (
  <div className="App" id="App">
    <Navbar setQuery={setQuery} />
    <main className="weather">
      {weather && (
        <>
          <CurrentWeather ... />
          <WeeklyForecast ... />
        </>
      )}
    </main>
    <Footer />
    <Analytics />
  </div>
);
```

---

## Summary of Recommended Actions

### Priority 1 (Critical - Fix Immediately)
1. Fix Footer.tsx component name
2. Remove unused props from Navbar
3. Remove unused dependencies (react-toastify, gsap, web-vitals)
4. Add error/loading states

### Priority 2 (Major - Fix Soon)
1. Create shared types file to eliminate duplication
2. Update outdated dependencies (especially react-tooltip v5)
3. Remove console.log statements
4. Fix HTTP to HTTPS for icon URLs
5. Add proper test cases

### Priority 3 (Minor - Nice to Have)
1. Consolidate SCSS colors into variables
2. Remove compiled CSS files from source
3. Add accessibility improvements
4. Optimize Vanta effect initialization
5. Remove empty _colors.scss or populate it

---

## Quick Reference: Package Updates

```bash
# Remove unused packages
npm uninstall react-toastify gsap web-vitals

# Update packages (test after each major update)
npm install typescript@latest
npm install sass@latest
npm install react-icons@latest
npm install luxon@latest @types/luxon@latest
npm install react-tooltip@latest  # Note: Breaking changes in v5!

# Update three.js (check vanta compatibility first)
npm install three@latest @types/three@latest

# Move testing libs to devDependencies
npm install --save-dev @testing-library/jest-dom @testing-library/react @testing-library/user-event @types/jest
npm uninstall @testing-library/jest-dom @testing-library/react @testing-library/user-event @types/jest
npm install --save-dev @testing-library/jest-dom @testing-library/react @testing-library/user-event @types/jest
```

---

*End of Code Review*
