# CLAUDE.md

Project onboarding for Claude Code. Claims here can go stale — if something conflicts with the code, trust the code and update this file.

The human-facing README.md covers features, demo link, UX, and tech stack — don't duplicate it. This file captures the shape of the code and the non-obvious things.

## Stack & running

- React 19 + TypeScript (strict), **Vite** 7 (migrated off CRA). Sass via `sass-embedded`.
- Three.js via `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.
- Atmosphere / volumetric clouds via `@takram/three-atmosphere` and `@takram/three-clouds`.
- Node 24 (`.nvmrc`). `.npmrc` pins `legacy-peer-deps=true`.
- Scripts: `npm start` / `npm run dev` (Vite dev), `npm run build` (`tsc -b && vite build`), `npm run preview`. No tests authored. No lint/format scripts.
- No env vars required. Open-Meteo and Nominatim are called directly from the browser.
- Fonts: **Chakra Petch** (sans body) + **Geist Mono** (small uppercase labels), both from Google Fonts. OKLCH design tokens defined in `src/index.scss` (`--fg*`, `--stroke*`, `--fill*`, `--accent-warm/cool/good`, `--blur: 24px`, etc.).

## Data flow (one path, memorise it)

```
WeatherQuery {q | lat,lon}
  → services/weatherService.ts
      → geocoder.ts   (Open-Meteo search; reverseGeocode via Nominatim)
      → weatherApi.ts (Open-Meteo /forecast — current + hourly + daily,
                       forecast_hours=25, forecast_days=8)
      → weatherFormatter.ts → WeatherData { current, daily[], hourly[] }
  → weather/config.ts: mapToSimulationConfig(weather, overrides)
      uses weather/codes.ts (WMO → EffectType) to derive effectType/intensity/
      cloudCover; merges DebugOverrides ("auto" = pass through)
  → <WeatherSceneContainer> wraps <WeatherScene config={…}/>
  → scene/effects read SimulationConfig every frame
```

`App.tsx` owns all top-level state (query, units, weather, overrides, debug UI, freeCamera, map drawer) and the `.shell` layout (topbar → main → stack → footer). `WeatherSceneContainer` also flips a frost overlay on when `temperature < 0` (opacity `0.5`).

## Directory map

```
src/
  App.tsx                       top-level state + keybinds (F7 debug, C free cam)
  index.tsx, index.scss         OKLCH tokens, shell layout, footer rules
  services/                     weatherService, weatherApi, geocoder, weatherFormatter
                                weatherFormatter.ts owns CARDINALS + toCardinal()
  weather/                      config (map → SimulationConfig), codes (WMO → effect), types
  components/
    navbar/                     brand, loc-btn + search pill + map-btn, units toggle
    map-picker/                 Leaflet drawer (glass restyled)
    weather-scene/              WeatherSceneContainer (SceneErrorBoundary + frost overlay)
    weather/
      current/                  CurrentWeather hero card (meta-row, 8-stat grid, sun/moon arc)
      hourly/                   HourlyChart (12-point SVG line chart + HTML dot/label overlay)
      weekly/                   WeeklyForecast (6 glass tiles, date, condition, precip, wind, UV)
    debug-menu/                 F7 overlay (exports isOverridesDirty used by App)
  weather-scene/                the R3F scene itself
    WeatherScene.tsx            <Canvas> + SceneContent
    types.ts                    re-exports weather types + FrustumBounds
    scene/
      CameraRig.tsx             parallax (gyro on mobile, pointer on desktop)
      FreeCameraWASD.tsx        debug-only, paired with <OrbitControls/>
      DebugBox.tsx, useDeviceOrientation.ts
    physics/weatherPhysics.ts   wind/fall-speed constants + windToXZ()
    effects/
      index.ts                  barrel — exports SkyStage + particle/fog/lightning
      SkyStage.tsx              canonical <Atmosphere> + <EffectComposer>
                                {<Clouds>, <AerialPerspective sky sun moon
                                sunLight skyLight>, <ToneMapping AGX>}
      VolumetricClouds.tsx      @takram/three-clouds pass (library defaults)
      Rain/Snow/Mist/Fog/LightningEffect.tsx
      internal/                 module-private helpers — do NOT import from outside effects/
        cloudProps.ts, cloudTiers.ts
        effectBounds.ts, effectColors.ts, fogNoise.ts, particleUtils.ts
```

## Scene rendering pipeline — canonical takram setup

The scene mirrors the official **`Clouds-Basic`** Storybook story from `takram-design-engineering/three-geospatial`. Sun, moon, sky color, sun light, and sky light all come from `<AerialPerspective>`'s post-process flags — there are no custom sun/moon meshes, no custom god-rays pass, and no custom lens-flare passes.

`SceneContent` in `WeatherScene.tsx` mounts components in this order so `useFrame` callbacks fire in the right sequence:

1. **CameraRig / FreeCameraWASD** (mounted first) — updates `camera.position` and calls `camera.updateMatrixWorld(true)` which refreshes `camera.matrixWorldInverse`. Mounted before SkyStage so any post-process pass that projects with the camera sees the up-to-date matrix.
2. **SkyStage** — contains:
   - `<Atmosphere ref correctAltitude textures={CDN_URL}>` with a per-frame `updateByDate(...)` driven by `config.dt` / `useRealtimeClock`.
   - Inside the atmosphere context: `useLayoutEffect` installs `worldToECEFMatrix` via `Ellipsoid.WGS84.getNorthUpEastFrame(surfaceECEF, …)` so the sun/moon directions reflect the *viewed city's* local time. Without this, the atmosphere always paints the (0,0)-equator schedule.
   - `<EffectComposer multisampling={0} enableNormalPass>` containing, in order:
     1. `<VolumetricClouds config>` → `<Clouds coverage *Velocity>`
     2. `<AerialPerspective sky sun moon sunLight skyLight />`
     3. `<ToneMapping mode={AGX} />`
3. Particle / fog / lightning effects.
4. Debug box + Stats panels (when F7 is open).

`enableNormalPass` is required because `AerialPerspective sunLight skyLight` does post-process Lambertian lighting on scene geometry. `multisampling={0}` because MSAA isn't worth the cost on top of the cloud raymarch.

### Why no `NoToneMapping` override on `<Canvas>`

The canonical setup leaves `gl.toneMapping` at R3F's default. We then post-process with `<ToneMapping mode={AGX}/>`. That works because the postprocess `<ToneMapping>` pass writes its result back to the framebuffer in display-space; R3F's renderer-level tonemap does not double-apply when the EffectComposer is the last thing to write.

### `<Canvas>` config

```tsx
<Canvas
  gl={{ depth: false, alpha: true }}
  camera={{ position: [0, 0, 5], fov: 75, near: 1, far: 4e5 }}
  ...
/>
```

`gl.depth: false` because the Atmosphere + Clouds passes manage depth themselves through the EffectComposer's normal pass. `near: 1, far: 4e5` matches takram's recommendation — gives plenty of depth precision for the atmospheric scattering shader without overflow.

### What was removed in the canonical migration

The previous custom layer is gone. Specifically deleted:

- `effects/CelestialBodies.tsx` — sun/moon meshes following a fixed arc. Replaced by `<AerialPerspective sun moon>` which renders both bodies in their actual ECEF positions.
- `effects/GodRays.tsx` — `@react-three/postprocessing` `GodRays` pass targeting our sun mesh. No canonical equivalent — the takram atmosphere handles aerial-light scattering inside `AerialPerspective`.
- `effects/LensFlare.tsx` + `effects/internal/BodyLensFlare.tsx` — custom per-body `LensFlareEffect` passes. The canonical setup uses `LensFlare` from `@takram/three-geospatial-effects/r3f`; that package is not currently installed.
- `effects/internal/flareProps.ts` — opacity gates / colour gain config for the custom flares.
- `effects/internal/qualityPreset.ts` — GPU sniffing + tier-based DPR/MSAA/cloud-quality selection. The canonical setup uses `qualityPreset='high'` with no tier detection.
- `SceneRefsContext.tsx` — sun/moon mesh + world-position refs shared between CelestialBodies, GodRays, and BodyLensFlare. None of those exist any more.
- The custom `<ambientLight>` + `<directionalLight>` from `WeatherScene.tsx` — sun/sky light comes from `AerialPerspective`'s `sunLight skyLight` flags.
- The `<Stars>` (drei) at night — `<AerialPerspective>` already renders the night sky with stars.

Bundle size dropped ~40 KB JS / ~12 KB gzipped after this cleanup.

### Scene origin frame

The scene sits ~500 m above WGS84 **at the viewed city's (lat, lon)**, North-Up-East: **+X=north, +Y=up, +Z=east**. `SURFACE_ECEF` is computed each render from `config.lat`/`config.lon` via `new Geodetic(lon, lat, 500).toECEF()`; the matrix is installed in `SkyStageInside` via `Ellipsoid.WGS84.getNorthUpEastFrame(surfaceECEF, worldToECEFMatrix)` inside `useLayoutEffect` keyed on the memoised ECEF — re-runs on city change so dusk/dawn/night colouring follows the new local time. `useEffect` (instead of layout) races with `AerialPerspective`'s first `useFrame` and leaves the sky looking at Earth's interior.

### Volumetric clouds — library defaults

`VolumetricClouds.tsx` mounts `<Clouds>` with only the weather-driven `coverage` + wind-velocity props. Everything else uses the library defaults: 4-layer stack 750 – 8500 m (cumulus / altostratus / cirrus), default `qualityPreset='high'`, default `maxRayDistance = 200 km`, default `skyLightScale = 1`, default `groundBounceScale = 1`, default `scatteringCoefficient = 1`.

`buildCloudsProps(config)` in `internal/cloudProps.ts`:

- `coverage` from `cloudTiers.ts` smoothstep on `config.cloudCover`
- `localWeatherVelocity` / `shapeVelocity` / `shapeDetailVelocity` derived from `config.windSpeed` (km/h) and `config.windDirection` with three tuned multipliers (`WIND_TO_LOCAL_WEATHER`, `WIND_TO_SHAPE`, `WIND_TO_DETAIL`). `MIN_DRIFT` keeps the sky breathing at wind=0.

- Wind drives clouds via `buildCloudsProps`. `windSpeed` (km/h) → m/s → three tuned factors (`WIND_TO_LOCAL_WEATHER`, `WIND_TO_SHAPE`, `WIND_TO_DETAIL`). `MIN_DRIFT` keeps the sky breathing at wind=0. Factors are ~4× lower than ground-wind units would suggest because angular velocity falls off with distance — clouds kilometres overhead shouldn't sprint across the sky.
- Quality tier detection (`qualityPreset.ts`) **sniffs `UNMASKED_RENDERER_WEBGL`** — integrated GPUs (Intel UHD / Iris / Iris Xe, Mali, Adreno, PowerVR, SwiftShader, ANGLE) are pinned to `low` regardless of core count. Apple M-series is treated as discrete. `WEBGL_debug_renderer_info` unavailable → `low` (safer default). Tier maps to three-clouds' internal presets AND to a `resolutionScale` applied to the clouds fullscreen pass.
- Main `<Canvas>` also tiers by GPU: on low tier, DPR is clamped to 1 and MSAA is off.
- `cloudTiers.ts` remaps linear `config.cloudCover` 0..1 onto `{coverage, densityScale}` via five anchors with smoothstep; early-exits to zero at `cover ≤ 0.05` so the `<Clouds>` pass contributes no mass on a clear day.

### SceneRefsContext

Shared refs: `sunMeshRef`, `moonMeshRef`, `sunWorldPosRef`, `moonWorldPosRef`. CelestialBodies writes all four every frame (mesh position + world-pos Vector3). GodRays reads `sunMeshRef` to target its pass; `LensFlare`/`BodyLensFlare` read `*WorldPosRef` to project to NDC. Only `useSceneRefsRequired()` is exported — there's no optional variant.

## Non-obvious gotchas (the ones that will bite you)

- **CameraRig must mount before SkyStage.** See "Scene rendering pipeline" above. This was a real bug — anything that projected with the camera trailed the scene by one frame during parallax motion until the mount order was fixed.
- **Atmosphere textures come from the CDN** (`DEFAULT_PRECOMPUTED_TEXTURES_URL`) to sidestep a React 19 StrictMode race in `PrecomputedTexturesGenerator` — async multi-frame texture build vs. effect cleanup calling `dispose()`. The canonical Storybook story relies on the in-process generator instead; switch back to that (drop the `textures` prop) if you ever stop hitting the StrictMode bug.
- **`worldToECEFMatrix` is set in `SkyStageInside`'s `useLayoutEffect`**, not `useEffect`. `useEffect` would race `AerialPerspective`'s first `useFrame` (which copies the matrix into its uniform) and leave the sky looking at Earth's interior. Re-runs when `config.lat` or `config.lon` changes.
- **Rain and snow are `THREE.Points` with `sizeAttenuation: false`**; size is multiplied by clamped `devicePixelRatio` (max 2). Snow uses 3 textured layers with phase-offset sway. `setDrawRange` controls active particle count — allocated buffers are `MAX_*` sized once and never reallocated.
- **`SceneErrorBoundary` in `WeatherSceneContainer` silently renders `null`** on error. If the 3D scene vanishes in dev, open DevTools — no visible fallback.

## UI conventions

- Glass cards use `backdrop-filter: blur(var(--blur)) saturate(1.3)` (24 px). The weekly forecast tiles override to `blur(32px) saturate(1.6)` for a stronger frosted effect over bright sky pixels.
- Small labels use `font-family: var(--font-mono)` uppercase 10–11 px with positive letter-spacing; body and temperatures use `var(--font-sans)` (Chakra Petch).
- Footer is a 2-row block inside `.stack`: top row is `[status] … [attrib]` (`space-between`), bottom row centres the SkorczanFFF GitHub pill.
- Hero sun/moon arc uses `preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke` on the SVG arc path, and renders the sun/moon glyph as an absolutely positioned HTML overlay (so it stays circular when the track is stretched wide). Progress is rendered via a `<clipPath>` rect whose width grows with time — **not** `stroke-dasharray`, which doesn't normalise correctly under `preserveAspectRatio="none"` + `non-scaling-stroke` and produces disjoint painted segments.
- Hourly chart uses the same hybrid: SVG path + area + grid with `non-scaling-stroke`, HTML overlay for data points and hour labels so they aren't horizontally stretched.

## Debug menu & overrides

- **F7** toggles the menu; **C** toggles free camera (only while debug menu is open). Key handlers ignore inputs/textareas.
- Every override accepts a literal value or the string `"auto"` (pass-through). `isOverridesDirty()` is the single source of truth for "is a simulated state active"; `App.tsx` wires it to `Navbar` to show a `DEBUG` badge in the brand slot. The dirty-check iterates `OVERRIDE_KEYS` — add new override keys there when you extend `DebugOverrides`.
- Overriding `effectType` to a weather effect auto-bumps `cloudCover` (thunderstorm ≥0.95, rain/snow ≥0.85, fog ≥0.9). Overriding `timeOfDay` disables `useRealtimeClock` so the pinned `dt` is used.
- **Cloud-related overrides that work in the canonical setup:** just `cloudCover` (0..1) — nothing else feeds the `<Clouds>` component. The previous custom knobs (`cloudOpacity`, `skyLightScale`, `groundBounceScale`, `cloudCount`, `cloudColor`) were removed when the cloud setup was reset to library defaults.
- `debugBoxPosition` is independent world-space coordinates for the wireframe cube (used to eyeball distances).

## Conventions

- Files use named exports, except `WeatherSceneContainer` and `App` which default-export. Barrel at `weather-scene/effects/index.ts` — only export particle/fog/lightning effects and `SkyStage`; CelestialBodies/VolumetricClouds/GodRays/LensFlare are internal to SkyStage.
- `effects/internal/` is module-private. Nothing outside `effects/` imports from it.
- New `SimulationConfig` fields: add to `weather/types.ts`, default in `weather/config.ts` `DEFAULT_CONFIG`, populate from weather in the inline object, and plumb an override (with `"auto"`) if user-adjustable.
- Per-frame allocations: avoid in `useFrame`. Existing code uses `useRef(new Vector3())` scratches and preallocated typed arrays; keep that pattern.
- Textures & geometries created in `useLayoutEffect` must be disposed in the cleanup (see `cleanupParticles` in `particleUtils.ts`).
- Wind compass labels come from `services/weatherFormatter.ts::toCardinal()` (16-point compass, shared by CurrentWeather and WeeklyForecast). Don't duplicate.

## Further reading

- **`docs/SCENE_ASTRONOMY.md`** — deep dive into how `@takram/three-atmosphere` + `@takram/three-clouds` actually compute the sky, why deep night is correctly black, and how the Open-Meteo `dt`/`lat`/`lon` flow into `updateByDate(...)` and `worldToECEFMatrix`. Read this before adjusting anything in `SkyStage.tsx` or `VolumetricClouds.tsx`.

## Things that are NOT bugs

- `.claude/` and `.cursor/` are gitignored — local editor state only.
- The `MistEffect` fragment shader uses a hand-rolled FBM texture baked once at 128×128 in `fogNoise.ts` — cached module-level, intentional.
- `tsconfig.node.json` (for `vite.config.ts`) and `tsconfig.tsbuildinfo` / `tsconfig.node.tsbuildinfo` (incremental-compile caches) are all required/harmless artefacts of `tsc -b`. Don't delete them.
