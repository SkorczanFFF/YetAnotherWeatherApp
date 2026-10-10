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
                       rain/showers/snowfall, wind_gusts_10m, visibility; hourly; daily)
      → weatherFormatter.ts → WeatherData { current, daily[], hourly[] }
  → weather/sceneParams.ts: mapToSceneParams(weather, units, overrides)
      SI units (m/s, °C, mm/h, cm/h, m); WMO traits via getCodeTraits() (+ codes.ts);
      continuous values only — no time-of-day phases; merges SceneOverrides ("auto" = pass through)
  → <WeatherSceneContainer> → <WeatherScene params={…}/>  (+ frost overlay, CSS night vars)
  → SceneRoot: <SceneDriver> turns params + clock into per-frame SceneSignals;
    every layer reads params (React props) + signals (inside useFrame)
```

`App.tsx` owns all top-level state (query, units, weather, overrides, debug tools, freeCamera, map drawer) and the `.shell` layout. `units` goes to the scene because Open-Meteo returns mph/°F in imperial mode.

## Directory map

```
src/
  App.tsx                       top-level state + keybinds (F7 debug, C free cam)
  services/                     weatherService, weatherApi, geocoder, weatherFormatter
  weather/
    sceneParams.ts              WeatherData + units + SceneOverrides → SceneParams; isNightAt, getFrostAmount
    scenePresets.ts             debug presets — one per weather-catalogue row
    codes.ts                    WMO → EffectType/intensity, cloud cover fallback
    types.ts                    API/domain types
  components/                   UI (navbar, map-picker, cards, debug-menu, weather-scene container)
  weather-scene/
    WeatherScene.tsx            <Canvas>, quality tier + PerformanceMonitor, SceneRoot (mount order!)
    core/
      worldFrame.ts             world convention: facing S/N, compassToWorld, windVelocity, heights, scales
      viewVolume.ts             frustum-derived spawn volumes (ViewFrame, halfWidthAt, elevatedBand, …)
      sceneSignals.tsx          per-frame shared state (context; mutable — never React state)
      SceneDriver.tsx           clock, suncalc (real + display directions), light/fog colours, gusts
      quality.ts                low / medium / high budgets
      CameraRig.tsx             static camera + subtle parallax (gyro / pointer); LOOK_TARGET
      FreeCameraWASD.tsx, FrameRateGate.tsx, useDeviceOrientation.ts, useIsMobile.ts, useNow.ts
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
      Lighting.tsx, FogLayer.tsx
    shaders/                    GLSL strings (skyGrade, stars, moon, cloudDeck, cloudNoise, volumetricClouds)
    debug/                      PerfProbe + perfStats (renderer.info), VolumeHelpers (spawn wireframes)
```

## World convention & "only where the camera looks"

- Camera at the origin, looking down **-Z**, pitched up 16°, FOV 50. **-Z = south** on the northern hemisphere and **north** on the southern one (`facingFor(lat)`), so the sun always crosses the frame. +X is the viewer's right (west when facing south). Azimuths follow suncalc (radians from south, + towards west). `compassToWorld` / `windVelocity` in `core/worldFrame.ts` are the only places bearings become vectors — wind FROM the west drifts clouds **leftwards**, from the north **away towards the horizon**.
- Sun and moon use the real altitude for light and colour (`signals.sunAlt`, `day`, `night`, `warmth`) but a **display direction** squeezed into the frame (azimuth ±135° → 80 % of the half-frame, altitude scaled under the top edge). Sky glow, sun disc, key light and moon all use the display direction so they agree. The volumetric clouds are lit from the display azimuth but the **real** altitude — the squeezed altitude lit every cloud nearly horizontally.
- Every layer spawns only inside volumes from `core/viewVolume.ts`, derived from the BASE camera frustum plus a margin covering the parallax range. Drifting things wrap at volume edges that are off-screen or deep in the horizon fog. Precipitation particles get a life that ends exactly when they leave the frame (`ViewVolumeEmitter`). The volumetric clouds need no volume: they are raymarched per pixel of the view, so their cost follows the cloud target size, not the sky. Check it with the debug "spawn volumes" toggle + free camera.

## Scene rendering pipeline

No EffectComposer, no post-process. The only offscreen work is the volumetric cloud pass (one full-screen draw into a low-res target per frame, plus the one-off 3D noise generation). Typically 4–7 draw calls including it.

**Volumetric clouds** (`layers/VolumetricClouds.tsx`, `shaders/volumetricClouds.glsl.ts`):
- A spherical shell over a curved Earth, in metres; shell base/thickness/coverage/type (stratus → cumulus → cumulonimbus) come from `SceneParams` (`shellTargets()`). Cirrus is a 2D layer at 8.5 km in the same pass.
- Density: Perlin-Worley base shape × height gradient, remapped by a scrolling weather-coverage noise, eroded by Worley detail; closed decks keep a lumpy base. Noise is a tileable RGBA 3D texture rendered slice by slice on the GPU at first mount (`getCloudNoise3D`, cached per size).
- Lighting: light march towards the sun (or moon), Beer + direction-aware powder, 3-lobe HG phase, depth-weighted multiple-scattering octaves, density-dependent height ambient, aerial perspective to the horizon colour, lightning glow from `signals.flashPosition`. The sun keeps lighting cloud bases ~6° below the horizon (red undersides at dusk).
- Cost control: render target at `budget.volumetric.scale` of the canvas; each frame re-marches one pixel of every 2×2 block and blends with history (reprojected by view direction, so parallax doesn't smear). Any weather/debug change resets history. Wind drifts the noise by `signals.windOffset × CLOUD_TIMELAPSE`.
- Composite: full-screen quad, renderOrder 2 (over sky/stars/moon, under precipitation). It **un-premultiplies before tone mapping and sRGB encoding** — see gotchas.

Mount order in `SceneRoot` is load-bearing (R3F runs useFrame callbacks in subscription order):

1. **`<FrameRateGate fps={budget.fps}>`** — pairs with `frameloop="demand"`; caps at 60 fps (30 on tier `low`).
2. **`<CameraRig>`**, or **`<OrbitControls maxDistance={600}>` + `<FreeCameraWASD>`** in free-cam mode.
3. **`<SceneDriver>`** — writes this frame's `SceneSignals` (clock, celestial, colours, fog density from visibility, gust-modulated wind, accumulated wind offset).
4. `<FogLayer>` (scene `FogExp2`) and `<Lighting>` (sun + moon directional, hemisphere, bolt point light — always mounted, only intensities change, so lit materials never recompile).
5. **`<SkyLayer>`** (renderOrder −2) → **`<SkyGrade>`** (−1) → **`<StarField>`** (0) → **`<Moon>`** (1).
6. **`<VolumetricClouds>`** composite (2) — or **`<CloudDeck>`** (2) on tier `potato`.
7. **`<Precipitation>`** (4) → **`<Thunder>`** bolt (5) → **`<DiamondDust>`** (6).
8. Debug: `<VolumeHelpers>` (10), `<PerfProbe>` + three drei `<Stats>`.

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
- **drei `<Sky>` is a box** (`distance` 3000) pinned to the far plane via `z = w`; leaving it in free cam shows black — hence `OrbitControls maxDistance`.
- **Cloud noise is generated once.** The volumetric 3D noise (`getCloudNoise3D`) renders into a `WebGL3DRenderTarget` slice by slice via `setRenderTarget(target, layer)` and is cached per size. The fallback deck's 2D FBM (`getCloudNoiseTexture()`, ~30 ms CPU) is a module singleton — assign it after `UniformsUtils.merge`, which would clone it.
- **`frameloop="demand"` + `FrameRateGate` is mandatory.** Without the pair the scene renders at monitor rate. The gate renders every N-th rAF tick (N from the measured display interval) — never gate on `elapsed >= 1000/fps`: rAF jitter makes that drop random frames (~39 fps with hitches on a 60 Hz screen), and `PerformanceMonitor` then lowers the tier.
- **Thunder uses the R3F clock only.** The old version mixed `performance.now()` with `state.clock`, which delayed the first flash by the page's age.
- **Scene time**: live = `Date.now()` + suncalc (location timezone irrelevant for an instant). The formatter's `dt` / `sunrise` parse local ISO strings in the browser zone — the scene doesn't use them.
- **Never sRGB-encode premultiplied colour.** The cloud target is premultiplied; encoding it directly inflates thin edges (sRGB's linear toe is ×12.92) and draws white outlines around every cloud. The composite divides by alpha first, then tone-maps/encodes, then normal-blends.
- **`gl.render()` inside `useFrame` resets `renderer.info`.** `PerfProbe` disables auto-reset and resets once per frame, so the readout covers the cloud pass + the main render.
- **Headless/software GL (SwiftShader) runs the scene at ~3–10 fps**, so `PerformanceMonitor` drops straight to `potato` — pin the tier in the debug menu when taking screenshots. The 128³ noise also takes seconds there (milliseconds on a real GPU).
- **`SceneErrorBoundary` in `WeatherSceneContainer` silently renders `null`** on error. If the 3D scene vanishes in dev, open DevTools.

## UI conventions

- Glass cards use `backdrop-filter: blur(var(--blur)) saturate(1.3)`. The weekly forecast tiles override to `blur(32px) saturate(1.6)` for a stronger frosted effect over bright sky pixels.
- Small labels use `font-family: var(--font-mono)` uppercase 10–11 px with positive letter-spacing; body and temperatures use `var(--font-sans)` (Chakra Petch).
- Footer is a 2-row block inside `.stack`: top row `[status] … [attrib]`, bottom row centres the SkorczanFFF GitHub pill.
- Hero sun/moon arc uses `preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`. Progress via a `<clipPath>` rect, not `stroke-dasharray` (which doesn't normalise correctly under those settings).
- Hourly chart: SVG path + area + grid with `non-scaling-stroke`, HTML overlay for data points and hour labels so they aren't horizontally stretched.

## Debug menu & overrides

- **F7** toggles the menu; **C** toggles free camera (only while the menu is open). Key handlers ignore inputs/textareas.
- **Presets** (`weather/scenePresets.ts`) pin every weather key, one per catalogue row (clear → hailstorm, fog, rime, sleet, blizzard, diamond dust, heat, gale…). "auto" clears exactly those keys.
- Time: local-hour slider (location timezone) + date; a pinned time stops the live clock. The readout shows sun altitude and moon phase.
- Every override is a literal or `"auto"`. `isOverridesDirty()` (in `sceneParams.ts`, re-exported by `DebugMenu`) drives the Navbar `DEBUG` badge; it iterates `OVERRIDE_KEYS` — add new keys there.
- Auto-bumps in `applyOverrides`: precipitation raises low cloud (≥ 0.85; showers ≥ 0.6; thunder ≥ 0.95); thunder/hail without a rate bring 6 mm/h rain; rime caps visibility at 400 m.
- Tools: quality tier pin, "spawn volumes" wireframes, perf readout (fps, draw calls, triangles, points, tier), ⚡ force lightning (works without a storm).

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
