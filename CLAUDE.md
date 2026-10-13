# CLAUDE.md

Project onboarding for Claude Code. Claims here can go stale — if something conflicts with the code, trust the code and update this file.

The human-facing README.md covers features, demo link, UX, and tech stack — don't duplicate it. This file captures the shape of the code and the non-obvious things.

## Stack & running

- React 19 + TypeScript (strict), **Vite** 7 (migrated off CRA). Sass via `sass-embedded`.
- Three.js via `@react-three/fiber` + `@react-three/drei`, `three.quarks` (particles), `suncalc` (sun/moon). Clouds are our own volumetric raymarch (`layers/VolumetricClouds.tsx`). The scene rewrite is documented in `SCENE_REFACTOR.md` (plan + weather catalogue).
- **Banned libraries**: `@react-three/postprocessing` / `postprocessing` (every compose pass adds overdraw), `@takram/three-atmosphere`, `@takram/three-clouds` (their full-res volumetrics killed mid-tier Android — ours is low-res + temporally amortised instead), drei `<Cloud>` / `<Clouds>` (sprite overdraw melted a 5070 Ti at 300 W, and they look flat), `r3f-perf` (pulls drei 9 → a second drei copy, incompatible with fiber 9 / React 19).
- Node 24 (`.nvmrc`). `.npmrc` pins `legacy-peer-deps=true`. New deps are pinned exact.
- Scripts: `npm start` / `npm run dev` (Vite dev), `npm run build` (`tsc -b && vite build`), `npm run preview`. No tests authored. No lint/format scripts.
- No env vars required. Open-Meteo and Nominatim are called directly from the browser.
- Fonts: **Chakra Petch** (sans body) + **Geist Mono** (small uppercase labels), both from Google Fonts. OKLCH design tokens defined in `src/index.scss`.

## Data flow (one path, memorise it)

```
WeatherQuery {q | lat,lon}
  → services/weatherService.ts
      → geocoder.ts   (Open-Meteo search; reverseGeocode via Nominatim)
      → weatherApi.ts (Open-Meteo /forecast — current incl. cloud_cover_low/mid/high,
                       rain/showers/snowfall, wind_gusts_10m, visibility, plus the
                       ATMOSPHERE_FIELDS: boundary layer, CAPE/LI/CIN, freezing level,
                       radiation, 850/300 hPa wind, cloud_cover + geopotential height
                       at PRESSURE_LEVELS; hourly; daily)
      → weatherFormatter.ts → WeatherData { current, atmosphere?, daily[], hourly[] }
  → weather/sceneParams.ts: mapToSceneParams(weather, units, overrides)
      SI units (m/s, °C, mm/h, cm/h, m); WMO traits via getCodeTraits() (+ codes.ts);
      continuous values only — no time-of-day phases; merges SceneOverrides ("auto" = pass through)
      → weather/cloudPhysics.ts: deriveCloudPhysics() → params.cloudPhysics
        (base, top, layer heights, optical depth, convection, winds aloft)
  → <WeatherSceneContainer> → <WeatherScene params={…}/>  (App passes its effectiveParams)
  → SceneRoot: <SceneDriver> turns params + clock into per-frame SceneSignals;
    every layer reads params (React props) + signals (inside useFrame)
```

`App.tsx` owns all top-level state (query, units, weather, overrides, debug tools, map drawer) and the `.shell` layout. `units` goes to the scene because Open-Meteo returns mph/°F in imperial mode.

## Directory map

```
src/
  App.tsx                       top-level state + debug entry (F7, or 5 taps on the footer status)
  services/                     weatherService, weatherApi, geocoder, weatherFormatter
  weather/
    sceneParams.ts              WeatherData + units + SceneOverrides → SceneParams; getFrostAmount
    cloudPhysics.ts             API atmosphere → cloud base/top/τ/convection/winds aloft (with fallbacks)
    scenePresets.ts             debug presets — one per weather-catalogue row
    codes.ts                    WMO → EffectType/intensity, cloud cover fallback
    types.ts                    API/domain types
  components/                   UI (navbar, map-picker, cards, loader, debug-menu, weather-scene container)
  weather-scene/
    WeatherScene.tsx            <Canvas>, quality tier + PerformanceMonitor, SceneRoot (mount order!)
    core/
      worldFrame.ts             world convention: facing S/N, compassToWorld, windVelocity, heights, scales
      viewVolume.ts             frustum-derived spawn volumes (ViewFrame, halfWidthAt, topAt/bottomAt, skyPatch, …)
      sceneSignals.tsx          per-frame shared state (context; mutable — never React state)
      SceneDriver.tsx           clock, suncalc (real + display directions), light/fog colours, gusts
      UiBacklight.tsx           scene brightness → `--scene-light` CSS var on <html> (drives the glass UI)
      quality.ts                low / medium / high budgets
      CameraRig.tsx             static camera + subtle parallax (gyro / pointer); LOOK_TARGET
      FrameRateGate.tsx, useDeviceOrientation.ts, useIsMobile.ts
      noiseTexture.ts           module-scoped tileable FBM 256×256 singleton
    layers/
      SkyLayer.tsx              drei <Sky> (Preetham) driven by the displayed sun
      SkyGrade.tsx              night gradient + overcast + horizon haze/fog + ground + flash (1 draw)
      StarField.tsx             points only inside the frame's sky patch, continuous opacity
      Moon.tsx                  moon.jpg disc with the real phase, lit limb towards the on-screen sun
      VolumetricClouds.tsx      Nubis-style raymarch (low-res ping-pong targets + temporal) + composite
      CloudDeck.tsx             "potato"-tier fallback: flat world-space plane at DECK_Y
      precip/                   three.quarks: Precipitation, ViewVolumeEmitter, textures
      Thunder.tsx               strike scheduler + drei <Line> bolts, drives signals.flash
      DiamondDust.tsx           drei <Sparkles> at ≤ −10 °C, clear and humid
      FrostGlass.tsx            procedural frosted pane (shaders/frost), grows 0 → −20 °C
      FogLayer.tsx              scene FogExp2, mounted only with the potato-tier deck (its one user)
    shaders/                    GLSL strings (skyGrade, stars, moon, cloudDeck, cloudNoise, volumetricClouds)
    debug/                      PerfProbe + perfStats (renderer.info)
```

## World convention & "only where the camera looks"

- Camera at the origin, looking down **-Z**, pitched up 22°, FOV 50 — the frame spans −3°…+47°: a thin horizon strip (sunrise/sunset stay in frame) and mostly sky; at 16° a broken deck seen sideways near the horizon hid its gaps. **-Z = south** on the northern hemisphere and **north** on the southern one (`facingFor(lat)`), so the sun always crosses the frame. +X is the viewer's right (west when facing south). Azimuths follow suncalc (radians from south, + towards west). `compassToWorld` / `windVelocity` in `core/worldFrame.ts` are the only places bearings become vectors — wind FROM the west drifts clouds **leftwards**, from the north **away towards the horizon**.
- Sun and moon use the real altitude for light and colour (`signals.sunAlt`, `day`, `night`, `warmth`) but a **display direction** squeezed into the frame (azimuth ±135° → 80 % of the half-frame, altitude scaled under the top edge). Sky glow, sun disc, key light and moon all use the display direction so they agree. The volumetric clouds are lit from the display azimuth but the **real** altitude — the squeezed altitude lit every cloud nearly horizontally.
- Every layer spawns only inside volumes from `core/viewVolume.ts`, derived from the BASE camera frustum plus a margin covering the parallax range. Drifting things wrap at volume edges that are off-screen or deep in the horizon fog. Precipitation particles get a life that ends exactly when they leave the frame (`ViewVolumeEmitter`). The volumetric clouds need no volume: they are raymarched per pixel of the view, so their cost follows the cloud target size, not the sky.

## Scene rendering pipeline

No EffectComposer, no post-process. The only offscreen work is the volumetric clouds: two small full-screen draws per frame (march into a half × half target, resolve into the low-res cloud target), plus the one-off 3D noise generation. Typically 5–8 draw calls including them.

**Volumetric clouds** (`layers/VolumetricClouds.tsx`, `shaders/volumetricClouds.glsl.ts`):
- A spherical shell over a curved Earth, in metres; shell base/thickness/coverage/type (stratus → cumulus → cumulonimbus) come from `params.cloudPhysics` (`shellTargets()`). Shell coverage = max(low, mid × 0.85) — high cover is the cirrus, never cumulus; total only when no layer explains it. The shell lifts to the mid level (altocumulus) only when mid clearly dominates *and* convection < 0.5. Cirrus is a 2D layer at the 250–300 hPa cloud height (default 8.5 km) in the same pass; detail erosion goes wispier above the freezing level.
- **Cloud physics** (`weather/cloudPhysics.ts`): base = LCL ≈ 125 m × (T − Td); top in stable air = boundary-layer height when the deck is inside it (≥ 100 m above the base — a lifting fog under a 230 m inversion drew a 900 m slab that closed the frame), raised to the highest cloudy low pressure level or, with none, capped at the first clear level above the base; grown by CAPE (≈ 4.2 m per J/kg, ≤ 11.5 km) — but CAPE is only potential: without showers or thunder, convection is capped at 0.6 (cumulus, never a cumulonimbus) and the top at max(base + 800 + 0.6·CAPE≤2000, highest pressure level with ≥ 5 % cloud + 300 m) (a clear, 2000 J/kg tropical afternoon drew 10 km extruded pillars before); mid/high layer altitudes from pressure-level `cloud_cover` × `geopotential_height` (minus elevation); optical depth τ estimated from thickness and precipitation, and in daylight blended (log space) towards the value inverted from the clearness index (shortwave / top-of-atmosphere ÷ 0.74, two-stream T = 1/(1 + 0.1125τ), attributed to the low/mid deck only) with a trust that grows as that deck closes (0.5 → 0.9) — one point reading can't tell a gap over the sun from thin cloud; τ ≥ 3 always, ≥ 15 when precipitating; density = τ / (thickness × SHELL_FILL). Every input has a fallback (no atmosphere block, night, debug overrides) — see `deriveCloudPhysics`. Overriding sky inputs in the debug menu drops the measured radiation (`trustRadiation`), overriding wind drops the winds aloft.
- Density: Perlin-Worley base shape × height gradient, remapped by a scrolling weather-coverage noise, eroded by Worley detail. **Coverage is calibrated:** the cover and cirrus noise mixes are near-normal and very narrow (cover μ 0.624 σ 0.050, cirrus μ 0.490 σ 0.081 — measured over the generated 128³ noise; re-measure if `cloudNoise.glsl` changes), so `noiseRank()` turns them into an even 0..1 rank via the logistic CDF and the top `uCoverage` share becomes cloud, with a wide edge (±0.18 rank, `COVER_EDGE`) — the falling cover at a cell's rim is what rounds its top; a sharp mask extrudes vertical walls. Before this, 20 % cover drew nothing and 60 % a closed deck. The cover field drifts through the noise's third axis with height (`coverRank(xz, hf)`), so a cell's outline changes as it rises — without it every rim was a vertical curtain. Convective towers also narrow with height (cover × up to 0.55 at the top). Cumulonimbus anvils spread into a halo around each cell only. Cirrus: streaks over the top `uHigh` share (alpha 0.35–0.65) + a cirrostratus veil above 55 %. closed decks keep a lumpy base. **Feature scale:** all noise lookups (cover, shape, detail) use metres ÷ `uFeatureScale` = (base + thickness/2) / 1200 m, clamped 0.2..1 (`FEATURE_REF_M`) — the noise was tuned for cumulus; a 150–300 m deck at full size was one 2.5 km cell across the whole frame, a featureless grey sheet. Noise is a tileable RGBA 3D texture rendered slice by slice on the GPU at first mount (`getCloudNoise3D`, cached per size).
- Lighting: light march towards the sun (or moon), Beer + direction-aware powder, 3-lobe HG phase, depth-weighted multiple-scattering octaves, density-dependent height ambient, aerial perspective to the horizon colour, lightning glow from `signals.flashPosition`. The sun keeps lighting cloud bases ~6° below the horizon (red undersides at dusk).
- Cost control: cloud target at `budget.volumetric.scale` of the canvas. The march pass covers one pixel of every 2×2 block per frame (half × half target; jitter = interleaved gradient noise rotated by the golden ratio per turn). The march is adaptive: cheap 3× steps through empty air (no detail, no lighting) until a hit, then back up one step and march fine; the fine step is ~2 % of the distance (≥ thickness / `steps`, ≤ 900 m), and `budget.steps` caps the *lit* samples per ray. The resolve pass reprojects history by view direction (so parallax doesn't smear), clips it to the mean ± 1.5σ of the 3×3 fresh march texels (no ghosts from drift or morphing) and blends (0.3 on the marched pixel, 0.06 on the upsampled rest). Weather/debug changes don't reset history: the shell parameters ease towards the new weather (`SHELL_EASE`, ~1 s). Low/mid clouds drift with the 850 hPa wind, integrated in noise space (÷ feature scale) inside `VolumetricClouds` so a changing scale zooms around the camera instead of sliding the field; cirrus with 300 hPa (`windOffsetHigh`), both × `CLOUD_TIMELAPSE` (4, a pure time-lapse of the real speed).
- Composite: full-screen quad, renderOrder 2 (over sky/stars/moon, under precipitation). It **un-premultiplies before tone mapping and sRGB encoding** — see gotchas.

Mount order in `SceneRoot` is load-bearing (R3F runs useFrame callbacks in subscription order):

1. **`<FrameRateGate fps={budget.fps}>`** — pairs with `frameloop="demand"`; caps at 60 fps (30 on tier `low`).
2. **`<CameraRig>`** (static camera + parallax).
3. **`<SceneDriver>`** — writes this frame's `SceneSignals` (clock, celestial, colours, fog density from visibility, gust-modulated surface wind, accumulated 850/300 hPa cloud drift). Then **`<UiBacklight>`** turns them into `--scene-light` for the DOM.
4. There are no three.js lights: every material is a custom shader or unlit, and the clouds take light colour/ambient straight from `SceneSignals`.
5. **`<SkyLayer>`** (renderOrder −2) → **`<SkyGrade>`** (−1) → **`<StarField>`** (0) → **`<Moon>`** (1).
6. **`<VolumetricClouds>`** composite (2) — or `<FogLayer>` (scene `FogExp2`) + **`<CloudDeck>`** (2) on tier `potato`.
7. **`<Precipitation>`** (4) → **`<Thunder>`** bolt (5, top at the cloud base) → **`<DiamondDust>`** (6) → **`<FrostGlass>`** (30).
8. Debug: `<PerfProbe>` + three drei `<Stats>`.

`<Canvas>`: `camera={{ position: [0, 0, 0], fov: 50, near: 0.5, far: 4000 }}`, `dpr={[1, budget.dprMax]}`, `gl={{ alpha: false, antialias: !isMobile }}`, `toneMappingExposure = 0.5` (set in `onCreated`, tuned for Preetham).

## Quality tiers

`useIsMobile()` picks the initial tier (mobile → `low`, desktop → `high`); drei `<PerformanceMonitor>` steps it down when fps drops below 75 % of the cap; the debug menu can pin it. Budgets live in `core/quality.ts`:

| | high | medium | low |
|---|---|---|---|
| DPR max / fps cap | 1.5 / 60 | 1.25 / 60 | 1 / 30 |
| Cloud target scale / steps / light steps | 0.5 / 64 / 6 | 0.4 / 48 / 5 | 0.33 / 32 / 4 |
| Cloud noise / max distance | 128³ / 60 km | 96³ / 50 km | 64³ / 40 km |
| Rain / snow / hail particles | 1800 / 1100 / 260 | 1000 / 650 / 150 | 450 / 300 / 80 |
| Stars / sparkles | 1600 / 320 | 1000 / 180 | 500 / 90 |

Below `low` sits **`potato`** (1 DPR, 30 fps, smaller particle budgets, flat `<CloudDeck>` instead of the raymarch). `PerformanceMonitor` only reaches it when `low` can't hold 30 fps.

## Non-obvious gotchas

- **Tone mapping.** Exposure is 0.5 for `<Sky>`; the cloud composite tone-maps with it too, so cloud radiance (light colour, ambient, haze ×1.4) is tuned in those pre-tonemap units. Anything that must keep its authored colour sets `toneMapped: false`. **three.quarks drops `toneMapped` when it builds its batch materials**, and drei `<Sparkles>` tone-maps too — both are patched at runtime; without it rain and snow render grey.
- **Custom ShaderMaterials end with `#include <colorspace_fragment>`** — colours are `THREE.Color` (linear) and must be converted, or hex palettes look wrong.
- **quarks particle textures are DataTextures with white RGB + alpha.** Canvas-backed textures came out premultiplied (grey edges) on some GPU paths. quarks' particle shader has no colour-space conversion, so those textures stay in "no colour space".
- **quarks emitters must hang under a `Scene`** (they're added to the `BatchedRenderer`, which is a scene child) or the system disposes itself. quarks clamps delta to 0.1 s. There's no `maxParticle` — visible count = emission rate × mean life (`ViewVolumeEmitter.meanLife` tracks it).
- **Stretched billboards:** streak length = |velocity| × `speedFactor` × size. `speedFactor: 0` makes rain invisible.
- **drei `<Sky>` is a box** (`distance` 3000) pinned to the far plane via `z = w`; a camera that leaves it sees black.
- **Cloud noise is generated once.** The volumetric 3D noise (`getCloudNoise3D`) renders into a `WebGL3DRenderTarget` slice by slice via `setRenderTarget(target, layer)` and is cached per size. The fallback deck's 2D FBM (`getCloudNoiseTexture()`, ~30 ms CPU) is a module singleton — assign it after `UniformsUtils.merge`, which would clone it.
- **`frameloop="demand"` + `FrameRateGate` is mandatory.** Without the pair the scene renders at monitor rate. The gate renders every N-th rAF tick (N from the measured display interval) — never gate on `elapsed >= 1000/fps`: rAF jitter makes that drop random frames (~39 fps with hitches on a 60 Hz screen), and `PerformanceMonitor` then lowers the tier.
- **Frost is a scene layer, not DOM.** `getFrostAmount` eases from 0 at 0 °C to 1 at `FROST_FULL_AT_C` (−20 °C), scaled by humidity, with a 0.35 floor for freezing rain / rime; `FrostGlass` moves towards it at 0.12/s (melt 0.25/s) and both its reach (≤ 0.32 of the short side) and opacity (≤ ~0.55 at the frame) grow with the amount, so the scene always shows through and the middle stays clear. The noise is mip-biased (blurred) and domain-warped so the 256² FBM tile never repeats visibly.
- **Thunder uses the R3F clock only.** The old version mixed `performance.now()` with `state.clock`, which delayed the first flash by the page's age.
- **Scene time**: live = `Date.now()` + suncalc (location timezone irrelevant for an instant). Open-Meteo (`timezone=auto`) returns location-local ISO strings without an offset; the formatter parses them in the location zone (`localSeconds`) — parsing in the browser zone shifted sunrise, the hourly labels and the day names by the zone difference.
- **Never sRGB-encode premultiplied colour.** The cloud target is premultiplied; encoding it directly inflates thin edges (sRGB's linear toe is ×12.92) and draws white outlines around every cloud. The composite divides by alpha first, then tone-maps/encodes, then normal-blends.
- **`gl.render()` inside `useFrame` resets `renderer.info`.** `PerfProbe` disables auto-reset and resets once per frame, so the readout covers the cloud pass + the main render.
- **Headless/software GL (SwiftShader) runs the scene at ~3–10 fps**, so `PerformanceMonitor` drops straight to `potato` — pin the tier in the debug menu when taking screenshots. The 128³ noise also takes seconds there (milliseconds on a real GPU).
- **The current weather_code and cloud_cover disagree by design.** Open-Meteo's 15-min `current.weather_code` is the step of the hour ending at the next full hour, `cloud_cover` is interpolated between hours (11:15: "Mainly clear" next to 66 %). `weatherFormatter.ts::cloudCode()` re-derives pure cloud codes 0–3 from the shown cover with Open-Meteo's thresholds (< 20 / 50 / 80 %); fog, precipitation and storm codes stay. The scene never read the code for clouds (only `cloud_cover*`), so this only aligns the label and icon.
- **`signals.overcast` vs `signals.cloudFill`.** `overcast` (greys the sky and horizon, overcast ambient, hides stars/moon) starts only at 80 % low / 85 % mid cover — the gaps of a broken deck are blue; at 55 % it turned a 76 % "partly cloudy" frame uniformly grey. `cloudFill` (from 55 %) feeds only `<UiBacklight>`: the frame never shows the zenith (it spans −3°…+47°), so a broken deck already fills most of it with bright cloud.
- **`SceneErrorBoundary` in `WeatherSceneContainer` silently renders `null`** on error. If the 3D scene vanishes in dev, open DevTools.

## UI conventions

- **Liquid glass** = `@include liquid-glass` from `src/styles/_glass.scss` (hero, hourly, forecast tiles, navbar controls, footer pill, loaders). It is adaptive: `--scene-light` (0 night … 1 white overcast/fog at noon, eased and written by `<UiBacklight>` from `signals.cloudFill` + haze, fallback 0.4 in `:root`) darkens the backdrop (`brightness()`), thickens a smoke tint, firms up `--fg-dim/mute/faint` + `--stroke`, and fades in a text halo on `.shell`. Hover/active raise `--glass-lift` (registered via `@property`, non-inherited) instead of replacing `background`, which would drop the tint. Blur is `--glass-blur` (16 px, 12 px ≤ 720 px).
- **Cursor reveal** (Fluent-style) on every boxed UI element: `@include glass-reveal` (liquid glass includes it; buttons, the map drawer and its controls, debug buttons and the error box use it alone). It sets `--glass-spot: 1` (registered non-inherited); `styles/useGlassSpotlight.ts` (called in `App`) collects those elements across the page (skipping the canvas and Leaflet's map pane), and once per frame writes `--mx`/`--my` to every one within 160 px (`$glass-reveal`) of the cursor, hovered or not, parking the rest off-screen. The mixin's `::after` is a masked 1.5 px ring inside the border lit at that point — so edges light up even from the gap between two cards — and `:hover` fades `--glass-glow` in (liquid glass also gets an inner glow). The mixin owns `::after` and sets `position: relative` (pass `null` for elements that are already absolute/fixed); components use `::before` for their own decoration. A component with its own `transition` list must add `--glass-glow` to it. Replaced elements (input, select, img) can't carry it. Mouse only.
- Full-height overlays (map drawer, debug menu) use `100dvh` after a `100vh` fallback: on mobile `100vh` is the height with the browser bars hidden, which put the map's confirm button off-screen. Under 440 px the map drawer is a full-width sheet. The brand is the v1 two-line logo everywhere (underlined `YET ANOTHER` over `WEATHER APP`; `DEBUG` / `MODE` in debug).
- Shared SVG icons live in `components/icons.tsx` (`PinIcon`, `PIN_PATH`, `CLOUD_PATH`, `WeatherIcon`). `WeatherIcon` is the one weather-code → icon mapping (hero + forecast tiles; `tinted` puts sun/moon/bolt in `--accent-warm`): sky state with day/night, sun/moon cut out behind clouds with a mask, precipitation marks by type, count by intensity. Scaled shapes divide their stroke by the scale — `non-scaling-stroke` would pin it to screen pixels. No remote icons (the forecast used to hotlink OpenWeatherMap PNGs). The °C/°F symbol comes from `weatherFormatter.ts::tempSymbol()`. No icon library.
- Small labels use `font-family: var(--font-mono)` uppercase 10–11 px with positive letter-spacing; body and temperatures use `var(--font-sans)` (Chakra Petch).
- Footer is a 2-row block inside `.stack`: top row `[status] … [attrib]`, bottom row centres the SkorczanFFF GitHub pill.
- Hero sun/moon arc uses `preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`. Progress via a `<clipPath>` rect, not `stroke-dasharray` (which doesn't normalise correctly under those settings).
- Hourly chart: SVG path + area + grid with `non-scaling-stroke`, HTML overlay for data points and hour labels so they aren't horizontally stretched.
- **Loading** (`components/loader/`, liquid glass): `Spinner` (inside buttons), `LoaderPill` (floating status capsule, stays mounted and fades), `LoaderPanel` (first load, no data yet). `App` tracks a `LoadSource` (initial/search/location/map/units) for the labels and passes it to `Navbar` as `pending`. On a refetch the old data stays on screen but goes soft: the cards' *contents* (`.hero > *`, `.hourly > *`, `.forecast .day > *`) get `blur(3px)` + fade while the glass stays intact, and a pill centred in the viewport says what is loading. Loaders use a deeper tint + warm rim and breathing glow so they never read as the cards' grey. Never put filter/opacity on a card or its ancestors — it cuts the backdrop blur — and keep `.stack > *` entrance animations on `backwards` fill so they don't pin opacity at 1. The map picker shows a pill only for tile loads slower than 250 ms.
- Shown data is rendered with `weatherUnits` (the units it was fetched in), not the toggle's `units`, so a °C/°F switch never mislabels stale numbers or feeds them to the scene. Superseded fetches are cancelled in the effect cleanup.

## Debug menu & overrides

- **F7** toggles the menu (on phones: 5 quick taps on the footer "Open-Meteo · Live data" status). Key handlers ignore inputs/textareas.
- **Presets** (`weather/scenePresets.ts`) pin every weather key, one per catalogue row (clear → hailstorm, fog, rime, sleet, blizzard, diamond dust, heat, gale…). "auto" clears exactly those keys.
- Time: local-hour slider (location timezone) + date; a pinned time stops the live clock. The readout shows sun altitude and moon phase.
- Every override is a literal or `"auto"`. `isOverridesDirty()` (in `sceneParams.ts`) drives the Navbar `DEBUG` badge; it iterates `OVERRIDE_KEYS` — add new keys there.
- Auto-bumps in `applyOverrides`: precipitation *pinned in the menu* raises low cloud (≥ 0.85; showers ≥ 0.6; thunder ≥ 0.95) — measured weather keeps the model's cover, with only a floor in `fromWeather` (0.25 under rain/snow codes, 0.35 under thunder), so pinning e.g. the time never changes the clouds; thunder/hail without a rate bring 6 mm/h rain; rime caps visibility at 400 m.
- Cloud physics row: base m / top m / CAPE / τ overrides (τ "auto" = estimated once the sky is pinned), plus a readout of the derived physics, winds aloft and frost %.
- Tools: quality tier pin, perf readout (fps, draw calls, triangles, points, tier), ⚡ force lightning (works without a storm).

## Conventions

- Files use named exports, except `WeatherSceneContainer`, `DebugMenu` and `App`, which default-export.
- New scene input: add it to `SceneParams` (+ `DEFAULT_PARAMS`, `fromWeather`), add a `SceneOverrides` key + `OVERRIDE_KEYS` entry + `applyOverrides` line, add it to `CALM` in `scenePresets.ts` if it describes weather, and to the catalogue in `SCENE_REFACTOR.md`.
- Per-frame values go through `SceneSignals` (written once in `SceneDriver`), not React state. No allocations in `useFrame` — use refs/scratch objects.
- Materials, geometries and textures created in `useMemo` are disposed in an effect cleanup.
- Wind compass labels come from `services/weatherFormatter.ts::toCardinal()`. Don't duplicate.

## Things that are NOT bugs

- `.claude/` and `.cursor/` are gitignored — local editor state only.
- `tsconfig.node.json` and `tsconfig*.tsbuildinfo` are required/harmless artefacts of `tsc -b`. Don't delete them.
- The Vite `>500 KB` chunk warning is Leaflet + three.js (+ three.quarks); not worth chasing yet.
- The pre-baked cloud noise texture spends ~30 ms CPU on first scene mount.
- The `THREE.Clock` deprecation warning in the console comes from R3F/drei internals.
- `quarks.core` is never imported but stays pinned: `three.quarks` depends on `quarks.core: *`.
