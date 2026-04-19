# CLAUDE.md

Project onboarding for Claude Code. Claims here can go stale — if something conflicts with the code, trust the code and update this file.

The human-facing README.md covers features, demo link, UX, and tech stack — don't duplicate it. This file captures the shape of the code and the non-obvious things.

## Stack & running

- React 19 + TypeScript (strict), Create React App (`react-scripts` 5), Sass.
- Three.js via `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.
- Atmosphere / volumetric clouds via `@takram/three-atmosphere` and `@takram/three-clouds`.
- Node 24 (`.nvmrc`). `.npmrc` pins `legacy-peer-deps=true`.
- Scripts: `npm start`, `npm run build`, `npm test` (no tests authored). No lint/format scripts.
- No env vars required. Open-Meteo and Nominatim are called directly from the browser.

## Data flow (one path, memorize it)

```
WeatherQuery {q|lat,lon}
  → services/weatherService.ts
      → geocoder.ts (OpenMeteo search, ranked by PPLC/PPLA+population;
                     falls back lang→en; reverseGeocode via Nominatim)
      → weatherApi.ts (OpenMeteo /forecast)
      → weatherFormatter.ts (→ WeatherData)
  → weather/config.ts: mapToSimulationConfig(weather, overrides)
      uses weather/codes.ts to derive effectType/intensity/cloudCover
      from WMO codes; merges DebugOverrides ("auto" = pass through)
  → WeatherSceneContainer wraps <WeatherScene config={…}/>
  → scene/effects read SimulationConfig every frame
```

`App.tsx` owns all top-level state (query, units, weather, overrides, debug UI, freeCamera, map drawer). `WeatherSceneContainer` also flips the `--app-text-color` / `--app-accent-color` CSS vars on body based on `timeOfDay`, and renders the frost overlay when `temperature < 0`.

## Directory map

```
src/
  App.tsx                      top-level state + keybinds (F7 debug, C free cam)
  index.tsx, index.scss
  services/                    weatherService, weatherApi, geocoder, weatherFormatter, errors
  weather/                     config (map → SimulationConfig), codes (WMO → effect), types
  components/
    navbar/                    search, geolocation, map-picker trigger
    map-picker/                Leaflet drawer
    weather/{current,weekly}/
    weather-scene/             WeatherSceneContainer (SceneErrorBoundary + frost overlay)
    debug-menu/                F7 overlay (export isOverridesDirty used by App)
  weather-scene/               the R3F scene itself
    WeatherScene.tsx           <Canvas>, mounts SceneRefsProvider, effect tree
    SceneRefsContext.tsx       shared refs: sun/moon meshes + world positions + cloudGroup
    types.ts                   re-exports weather types + FrustumBounds
    scene/
      CameraRig.tsx            parallax (gyro on mobile, pointer on desktop)
      FreeCameraWASD.tsx       debug-only, paired with <OrbitControls/>
      DebugBox.tsx, useDeviceOrientation.ts
    physics/weatherPhysics.ts  wind/fall-speed constants + windToXZ()
    effects/
      index.ts                 barrel — import effects via "./effects"
      SkyStage.tsx             <Atmosphere> wrapper + EffectComposer composition
      CelestialBodies.tsx      sun glow sphere + moon billboard
      VolumetricClouds.tsx     @takram/three-clouds pass
      GodRays.tsx              postprocessing pass, reads sun mesh via SceneRefs
      LensFlare.tsx            sun + moon flares via BodyLensFlare
      Rain/Snow/Mist/Fog/LightningEffect.tsx
      internal/                module-private helpers — do NOT import from outside effects/
        cloudProps.ts, cloudTiers.ts, qualityPreset.ts
        effectBounds.ts, effectColors.ts, fogNoise.ts, particleUtils.ts
        flareProps.ts, BodyLensFlare.tsx
```

Empty legacy dirs: `src/weather-simulation/effects/` and `src/weather-scene/bounds/` (untracked leftovers; safe to delete if asked).

## Scene rendering pipeline

`<WeatherScene>` mounts one `<Canvas>` with `SceneRefsProvider` inside. Composition order inside `SceneContent` matters:

1. `<ambientLight>` + `<SkyStage>` — `<Atmosphere ground={false}>` drives sky color and exposes `sunDirection` / `moonDirection` / `worldToECEFMatrix` through `AtmosphereContext`.
2. `<Stars>` only at `timeOfDay === "night"`.
3. Camera: `<CameraRig>` (parallax) or `<OrbitControls> + <FreeCameraWASD>` (debug).
4. `<LightningEffect>` (full-screen flash plane, renderOrder 999).
5. `<FogEffect>` sets `scene.fog = FogExp2` per frame.
6. `<RainEffect>`, `<SnowEffect>`, `<MistEffect>` — particle systems.
7. If `showDebugBox`: wireframe cube + three `<Stats>` panels (FPS / MS / MB).

`<SkyStage>` itself contains an `<EffectComposer>` with: `<VolumetricClouds>` → `<AerialPerspective sky/>` → `<ToneMapping AGX/>` → `<GodRays>` → `<LensFlare>`. Clouds must composite before `AerialPerspective` so they receive sky color correctly.

### SceneRefsContext

`CelestialBodies` writes sun/moon mesh refs and their world positions every frame. `GodRays` reads `sunMeshRef` to target its pass; `LensFlare`/`BodyLensFlare` reads `sun/moonWorldPosRef` to project to NDC. This avoids callback plumbing through the composer tree.

### Scene origin frame

The scene sits ~500 m above WGS84 **at the viewed city's (lat, lon)**, North-Up-East: **+X=north, +Y=up, +Z=east**. `SURFACE_ECEF` is computed each render from `config.lat`/`config.lon` via `new Geodetic(lon, lat, 500).toECEF()`; the matrix is installed in `SkyStageInside` via `Ellipsoid.WGS84.getNorthUpEastFrame(surfaceECEF, worldToECEFMatrix)` inside `useLayoutEffect` keyed on the memoised ECEF — re-runs on city change so the sun reanchors to the new local time. Anchoring to the actual location is what makes dusk/dawn/night cycles read correctly — previously the frame was locked to (0,0), so the atmosphere always painted the equator's solar schedule regardless of which city was selected. `useEffect` (instead of layout) races with `AerialPerspective`'s first `useFrame` and leaves the sky looking at Earth's interior.

### Volumetric clouds: layers, wind, GPU

- The scene uses **two custom `<CloudLayer>` slabs on discrete GPUs, one on low tier**, not the library's default 4-layer stack. `VolumetricClouds.tsx` passes `disableDefaultLayers` and mounts a low layer at 560 m and (on non-low tier) a mid layer at 720 m — camera origin sits at 500 m. The default stack's cirrus at 7500 m is turned off for cost; `clouds-maxRayDistance` is clamped to 4 km on low tier, 8 km otherwise (vs. the library default 200 km), so the raymarch terminates early over the thin slab. On low tier the single layer absorbs a fraction of the disabled layer's density so the sky doesn't visually thin out.
- `CloudLayer.altitude` / `height` are absolute meters above the WGS84 ellipsoid — NOT scene-local offsets. A layer below 500 m is beneath the camera.
- `layer.shadow = false` on both layers: the CascadedShadowMaps pass is one of the largest cloud costs and contributes almost nothing visually given this scene's flat ground and thin-stack setup.
- Wind drives clouds via `buildCloudsProps` (`internal/cloudProps.ts`). API `windSpeed` (km/h) → m/s → multiplied by three tuned factors: `WIND_TO_LOCAL_WEATHER` (coverage churn), `WIND_TO_SHAPE` (gross shape drift), `WIND_TO_DETAIL` (turbulent edges). `MIN_DRIFT` keeps the sky breathing at wind=0. The factors are deliberately ~4× lower than ground-wind units would suggest because the apparent motion of distant objects is slower than the same physical speed up close (angular velocity falls off with distance) — clouds are kilometres overhead, not in your face. `MIN_DRIFT` values that look fine at ground scale read as a sprint across the sky.
- Quality tier detection (`qualityPreset.ts`) **sniffs the WebGL `UNMASKED_RENDERER_WEBGL` string**, not just `navigator.hardwareConcurrency`. Integrated GPUs (Intel UHD / Iris / Iris Xe, ARM Mali, Adreno, PowerVR, SwiftShader, ANGLE fallback) are pinned to `low` regardless of core count — CPU cores lie as a proxy for GPU throughput, a 20-thread i9-13900H on Iris Xe is still low-tier. Apple M-series is treated as discrete. If `WEBGL_debug_renderer_info` is unavailable (privacy mode / Firefox RFP), tier is "low" — safer default. Tier names map to three-clouds' internal presets AND to a `resolutionScale` that applies only to the clouds fullscreen pass.
- **Main `<Canvas>` also tiers by GPU**: on low tier, DPR is clamped to 1 and MSAA is off. Retina DPR 2× with 4× MSAA is ~8× the fragment work of DPR 1 without MSAA, and the cloud pass dominates anyway.
- **The `<Canvas>` explicitly sets `toneMapping: NoToneMapping`** because `<SkyStage>` runs a postprocess AGX `<ToneMapping>` inside its EffectComposer. R3F defaults the renderer to `ACESFilmicToneMapping`, so without this flag the framebuffer gets tonemapped *twice* — AGX in the postprocess pass, then ACES on output — crushing the midtones into a visibly "dark scene". If you switch the postprocess tonemap mode or rip out the `<ToneMapping>` pass, restore a renderer tonemap here to compensate, or the scene will render in raw HDR and clip to white.

## Non-obvious gotchas (the ones that will bite you)

- **Celestial bodies start `visible={false}`.** They only flip on once their ECEF→world direction produces a real position AND the time-of-day gate (`getTimeGates`) permits. Removing either guard reproduces the "moon flashes at screen center then disappears" bug — meshes default to position `(0,0,0)` which is the camera.
- **`worldToECEFMatrix` is refreshed every frame**, not cached on mount. It can be overwritten between effect cleanup and re-install when the Atmosphere subtree remounts (StrictMode, HMR).
- **Atmosphere textures come from the CDN** (`DEFAULT_PRECOMPUTED_TEXTURES_URL`) to sidestep a React 19 StrictMode race in `PrecomputedTexturesGenerator` — async multi-frame texture build vs. effect cleanup calling `dispose()`.
- **`BodyLensFlare` does NOT use `@react-three/postprocessing`'s `<LensFlare>` wrapper.** The wrapper memoises its effect on `JSON.stringify(...restProps)`; under React 19, `ref` counts as a regular prop and carries r3f's circular `__r3f` tree, which throws. `BodyLensFlare.tsx` builds `LensFlareEffect` manually and mounts it through a dedicated `EffectPass`. **Every flare needs its own pass** — two flares sharing one pass collide on the shader's `vec2 vTexCoord` local. Animated values flow through refs so the component renders exactly once.
- **Lens flare opacity is gated by 4 factors**: time-of-day (`getTimeGates`), cloud-cover attenuation (lerp toward target every frame), a 0.6 global ceiling, and NDC behind/clipped checks (`ndc.z > 1` or `|x|/|y| > 1.2`) inside `BodyLensFlare`.
- **Rain and snow are `THREE.Points` with `sizeAttenuation: false`**; size is multiplied by clamped `devicePixelRatio` (max 2). Snow uses 3 textured layers with phase-offset sway. `setDrawRange` controls active particle count — allocated buffers are `MAX_*` sized once and never reallocated.
- **Clouds use anchor lerp, not linear coverage.** `cloudTiers.ts` remaps `config.cloudCover` (0..1) onto `{coverage, densityScale}` via 5 anchors with smoothstep between them, and early-exits to zero at `cover ≤ 0.05`. Wind direction is `+X=sin(rad)`, `+Z=-cos(rad)` (0°=north, blowing from the compass heading). There's a `MIN_DRIFT` floor so clouds never fully freeze.
- **Quality tier is detected once per mount** (`detectQualityTier`): mobile or ≤4-core/HiDPI → `low`, up to 8 cores → `medium`, else `high`. Low disables god rays and moon flare. Defaults are intentionally conservative because `@takram/three-clouds` dominates GPU cost in this scene.
- **`SceneErrorBoundary` in `WeatherSceneContainer` silently renders `null`** on error — if the 3D scene vanishes in dev, check the console, there's no visible fallback.

## Debug menu & overrides

- **F7** toggles the menu; **C** toggles free camera (only while debug menu is open). Key handlers ignore inputs/textareas.
- Every override accepts a literal value or the string `"auto"` (pass-through). `isOverridesDirty()` is the single source of truth for "is a simulated state active"; `App.tsx` wires it to `Navbar` to show a debug badge.
- Overriding `effectType` to a weather effect auto-bumps `cloudCover` (thunderstorm ≥0.95, rain/snow ≥0.85, fog ≥0.9). Overriding `timeOfDay` disables `useRealtimeClock` so the pinned `dt` is used for sun/moon position.
- `debugBoxPosition` is independent world-space coordinates for the wireframe cube (used to eyeball distances).

## Conventions

- Files use named exports, except components like `WeatherSceneContainer` and `App` which default-export. Barrel at `weather-scene/effects/index.ts` — new effects should be added there.
- `effects/internal/` is module-private. Nothing outside `effects/` imports from it.
- New `SimulationConfig` fields: add to `weather/types.ts`, default in `weather/config.ts` `DEFAULT_CONFIG`, populate from weather in the inline object, and plumb an override (with `"auto"`) if user-adjustable.
- Per-frame allocations: avoid in `useFrame`. Existing code uses `useRef(new Vector3())` scratches and preallocated typed arrays; keep that pattern.
- Textures & geometries created in `useLayoutEffect` must be disposed in the cleanup (see `cleanupParticles` in `particleUtils.ts`).

## Branch state (as of this writing)

Working branch: `volumetric-clouds`. Large refactor in-flight — many files moved into `effects/internal/` and new `SkyStage.tsx` / `GodRays.tsx` / `LensFlare.tsx` / `effects/index.ts` replace the old `volumetricClouds/` and `lensFlare/` subfolders. The deleted `CLOUDS_REFACTOR.md` was the tracking doc for this work. Main branch is `master`.

Open work in `TODO.md`: cloud spawn bounds don't scale with screen width — on >1080p there's visible empty sky to the sides. Tied to `PRECIPITATION_BOUNDS` / cloud coverage area being fixed in world units rather than derived from camera aspect.

## Things that are NOT bugs

- `.claude/` and `.cursor/` are gitignored — local editor state only.
- `src/weather-simulation/` and `src/weather-scene/bounds/` are empty leftover directories; safe to remove.
- The `MistEffect` fragment shader uses a hand-rolled FBM texture baked once at 128×128 in `fogNoise.ts` — cached module-level, intentional.
