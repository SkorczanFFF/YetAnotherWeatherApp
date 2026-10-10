# CLAUDE.md

Project onboarding for Claude Code. Claims here can go stale — if something conflicts with the code, trust the code and update this file.

The human-facing README.md covers features, demo link, UX, and tech stack — don't duplicate it. This file captures the shape of the code and the non-obvious things.

## Stack & running

- React 19 + TypeScript (strict), **Vite** 7 (migrated off CRA). Sass via `sass-embedded`.
- Three.js via `@react-three/fiber` + `@react-three/drei`. The 3D scene is a layered clip-space composition — see the pipeline section below. **Explicitly banned libraries**: `@react-three/drei` `<Cloud>` / `<Clouds>` (transparent-sprite overdraw melted a 5070 Ti at 300 W), `@react-three/postprocessing` / `postprocessing` (every compose pass adds overdraw), `@takram/three-atmosphere`, `@takram/three-clouds` (volumetric raymarching killed mid-tier Android). Don't reach for them without reading the git log first.
- Node 24 (`.nvmrc`). `.npmrc` pins `legacy-peer-deps=true`.
- Scripts: `npm start` / `npm run dev` (Vite dev), `npm run build` (`tsc -b && vite build`), `npm run preview`. No tests authored. No lint/format scripts.
- No env vars required. Open-Meteo and Nominatim are called directly from the browser.
- Fonts: **Chakra Petch** (sans body) + **Geist Mono** (small uppercase labels), both from Google Fonts. OKLCH design tokens defined in `src/index.scss`.

## Data flow (one path, memorise it)

```
WeatherQuery {q | lat,lon}
  → services/weatherService.ts
      → geocoder.ts   (Open-Meteo search; reverseGeocode via Nominatim)
      → weatherApi.ts (Open-Meteo /forecast — current + hourly + daily)
      → weatherFormatter.ts → WeatherData { current, daily[], hourly[] }
  → weather/config.ts: mapToSimulationConfig(weather, overrides)
      uses weather/codes.ts (WMO → EffectType) to derive effectType/intensity;
      prefers API cloud_cover (0–100) over weather_code derivation;
      merges DebugOverrides ("auto" = pass through)
  → <WeatherSceneContainer> wraps <WeatherScene config={…}/>
  → Every effect component reads SimulationConfig + a single `isMobile` flag
```

`App.tsx` owns all top-level state (query, units, weather, overrides, debug UI, freeCamera, map drawer) and the `.shell` layout (topbar → main → stack → footer). `WeatherSceneContainer` also flips a frost overlay on when `temperature < 0` (opacity `0.5`).

## Directory map

```
src/
  App.tsx                       top-level state + keybinds (F7 debug, C free cam)
  index.tsx, index.scss         OKLCH tokens, shell layout, footer rules
  services/                     weatherService, weatherApi, geocoder, weatherFormatter
  weather/                      config (map → SimulationConfig), codes (WMO → effect), types
  components/                   UI (navbar, map-picker, current/hourly/weekly cards, debug-menu)
  weather-scene/                the R3F scene
    WeatherScene.tsx            <Canvas> + SceneContent orchestrator
    types.ts                    re-exports weather types + FrustumBounds
    scene/
      CameraRig.tsx             parallax (gyro on mobile, pointer on desktop); lookAt(0,0,0)
      FreeCameraWASD.tsx        debug-only, paired with <OrbitControls/>
      DebugBox.tsx              wireframe cube for distance eyeballing in debug menu
      FrameRateGate.tsx         rAF-throttled invalidate() — caps render at 60 fps
      phasePalette.ts           Record<TimeOfDay, PhasePalette> — central colour table
      useDeviceOrientation.ts   gyro permission + beta/gamma normalisation
      useIsMobile.ts            UA + matchMedia('pointer: coarse') — memoed per mount
    effects/
      SkyDome.tsx               fullscreen-quad gradient (horizon→zenith, phase lerp, uFlash)
      Celestial.tsx             sun + moon discs on a simple arc (sunrise → sunset progress)
      Stars.tsx                 drei <Stars> wrapper — count scaled by starsOpacity
      CloudLayer.tsx            THE central cloud renderer — one plane + FBM shader
      RainEffect.tsx            THREE.Points + vertical-streak shader
      SnowEffect.tsx            THREE.Points + snowflake1.png texture + sway
      FogEffect.tsx             fullscreen fog overlay (horizon-biased)
      ThunderEffect.tsx         no-geometry — drives SkyDome's uFlash via shared ref
      shaders/                  GLSL strings (skyDome / celestial / cloudLayer / rain / snow)
      internal/
        noiseTexture.ts         module-scoped tileable FBM 256×256 singleton
        particleBounds.ts       FOV-sized spawn/recycle box helper
```

## Scene rendering pipeline

Every layer is a single draw call. Worst case (thunderstorm with everything on): **6–7 draws total**. No EffectComposer, no render targets, no post-process.

Mount order in `SceneContent` (`WeatherScene.tsx`), matters for phase transitions + thunder driving SkyDome:

1. **`<FrameRateGate fps={60}>`** — pairs with `frameloop="demand"` on the Canvas. rAF-throttles `invalidate()` so on a 240 Hz display the scene still renders at 60 fps. This alone is the biggest perf win (4× fewer pipeline invocations than uncapped).
2. **`<CameraRig>` / `<FreeCameraWASD>`** — camera parallax; `lookAt(0, 0, 0)`. Mounted first so downstream useFrame callbacks see fresh `matrixWorldInverse`.
3. **`<SkyDome>`** — fullscreen clip-space quad. Shader `mix(uHorizon, uZenith, smoothstep(vUv.y))`. Phase palette lerp over ~0.5 s so dusk→night doesn't snap. `materialRef` is passed through so `<ThunderEffect>` can drive the `uFlash` uniform (lightning pop) without a second draw call.
4. **`<Stars>`** — drei `<Stars>` wrapped with conditional mount. drei's star shader has no continuous-opacity uniform (its `fade` is compared `== 1.0` in the frag), so we scale `count` by `starsOpacity` instead. Unmounted entirely when `timeOfDay === 'day'`.
5. **`<Celestial>`** — sun + moon disc billboards. Arc position: `angle = π × (dt - sunrise) / (sunset - sunrise)` for the sun; moon uses the inverse window (sunset → next sunrise, with a 24 h fallback when `next_sunrise` isn't in `SimulationConfig`). Both bodies below-horizon returns null, so one disc = 1 draw.
6. **`<CloudLayer>`** — the central piece. One `<planeGeometry args={[2,2]}>` as a clip-space quad with a custom shader. Samples a pre-baked 256×256 tileable FBM noise texture (singleton in `internal/noiseTexture.ts`) at two offset scales, blends, then thresholds by `cloudCover` + `uMode`. Modes switch via hysteresis at `cloudCover` crossing 0.68 / 0.72 to avoid flicker.
7. **`<RainEffect>` / `<SnowEffect>`** — mounted only when `effectType` matches. Plain `THREE.Points` with typed-array positions + per-frame recycle. Sway and size-attenuation in the vertex shader.
8. **`<FogEffect>`** — fullscreen horizon-biased fog overlay. Mounted only when `effectType === 'fog'` AND `fogDensity > 0.005`.
9. **`<ThunderEffect>`** — no geometry. Mounts only for thunderstorm. Schedules random 4–12 s flash intervals, drives `SkyDome`'s `uFlash` uniform via the shared `skyMaterialRef`.
10. Debug box + three `<Stats>` panels when F7 is open.

### `<Canvas>` config

```tsx
<Canvas
  frameloop="demand"                                  // FPS cap via FrameRateGate
  camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
  dpr={[1, isMobile ? 1 : 1.5]}
  gl={{ alpha: false, antialias: !isMobile }}
/>
```

Everything else is scene-level. `alpha: false` because `SkyDome` is always opaque. `antialias` off on mobile — we don't have opaque geometry edges that benefit from MSAA; the gradient + shader-based soft edges already AA themselves.

## Cloud shader cheat sheet

`CloudLayer.tsx` is the heart of the scene. Its shader (`shaders/cloudLayer.glsl.ts`):

```glsl
// Two-scale FBM sample — blends any seam from the pre-baked texture.
vec2 uv1 = vUv * 1.4 + uWindUV;
vec2 uv2 = vUv * 3.1 + uWindUV * 1.8;
float n  = texture2D(uNoise, uv1).r * 0.65 + texture2D(uNoise, uv2).r * 0.35;

// CUMULUS — sharp puffy threshold; cover controls size + count.
// STRATUS — flat blanket modulated by noise; cover controls fill.
alpha = mode == 0
  ? smoothstep(1.0 - cover * 0.85, 0.14 below it, n)
  : ((cover - 0.3) × 1.45) × (0.7 + 0.3 × smoothstep(0.25, 0.75, n));
```

`uWindUV` accumulates from `config.windSpeed` + `config.windDirection` every frame. The pre-baked FBM is tileable (`hash2D` wraps modulo the grid period, see `internal/noiseTexture.ts`), so arbitrary wind drift never shows a seam.

## Mobile adaptations

`useIsMobile()` — single source of truth. Resolved once per scene mount; doesn't flip on resize.

| Parameter | Desktop | Mobile |
|---|---|---|
| DPR clamp | `[1, 1.5]` | `[1, 1]` |
| `gl.antialias` | `true` | `false` |
| Rain particle count | 500 / 900 / 1500 | 250 / 450 / 700 |
| Snow particle count | 400 / 700 / 1000 | 200 / 350 / 500 |
| Stars max count | 2500 | 1200 |
| Thunder peak intensity | 1.0 | 0.7 |

## Non-obvious gotchas

- **`CameraRig` must mount before anything that projects with the camera.** Mount order in `SceneContent` is load-bearing — `CameraRig` updates `camera.matrixWorldInverse` before `useFrame` cascades into downstream effects.
- **Thunder drives SkyDome via a shared `skyMaterialRef`.** `ThunderEffect` itself returns `null` — there's no geometry to render. If you swap out the sky dome, keep the `uFlash` uniform or wire the ref somewhere else.
- **drei `<Stars>` fade is binary.** The shader compares `fade == 1.0` — it's not a continuous opacity. We scale `count` by `starsOpacity` to get the apparent dimming.
- **Cloud noise is baked once, module-scoped.** `getCloudNoiseTexture()` caches the result across all CloudLayer remounts. Don't try to regenerate the texture per-tier — it's a ~30 ms singleton.
- **`frameloop="demand"` + `FrameRateGate` is mandatory.** Without this pair, the scene renders at monitor rate (240+ fps on high-refresh displays) and burns GPU for zero visual benefit. The cap is also why thunder's uFlash decay looks smooth at 60 fps rather than flickering.
- **Particle volumes are sized to camera FOV.** `computeParticleBounds` in `internal/particleBounds.ts` takes `fov + aspect` and computes an axis-aligned box that covers the visible cone. Portrait (mobile) automatically gets a narrower box.
- **`SceneErrorBoundary` in `WeatherSceneContainer` silently renders `null`** on error. If the 3D scene vanishes in dev, open DevTools — there is no visible fallback.

## UI conventions

- Glass cards use `backdrop-filter: blur(var(--blur)) saturate(1.3)`. The weekly forecast tiles override to `blur(32px) saturate(1.6)` for a stronger frosted effect over bright sky pixels.
- Small labels use `font-family: var(--font-mono)` uppercase 10–11 px with positive letter-spacing; body and temperatures use `var(--font-sans)` (Chakra Petch).
- Footer is a 2-row block inside `.stack`: top row `[status] … [attrib]`, bottom row centres the SkorczanFFF GitHub pill.
- Hero sun/moon arc uses `preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`. Progress via a `<clipPath>` rect, not `stroke-dasharray` (which doesn't normalise correctly under those settings).
- Hourly chart: SVG path + area + grid with `non-scaling-stroke`, HTML overlay for data points and hour labels so they aren't horizontally stretched.

## Debug menu & overrides

- **F7** toggles the menu; **C** toggles free camera (only while debug menu is open). Key handlers ignore inputs/textareas.
- Every override accepts a literal value or the string `"auto"` (pass-through). `isOverridesDirty()` is the single source of truth for "is a simulated state active"; `App.tsx` wires it to `Navbar` to show a `DEBUG` badge in the brand slot. The dirty-check iterates `OVERRIDE_KEYS` — add new override keys there when you extend `DebugOverrides`.
- Overriding `effectType` to a weather effect auto-bumps `cloudCover` (thunderstorm ≥ 0.95, rain/snow ≥ 0.85, fog ≥ 0.9). Overriding `timeOfDay` disables `useRealtimeClock` so the pinned phase is used directly.
- **All overrides are LIVE** against the new scene — `cloudCover` drives `CloudLayer` cumulus/stratus switch, `windSpeed`/`windDirection` drift clouds + particles, `fogDensity` powers `FogEffect`, etc.
- `debugBoxPosition` is independent world-space coordinates for the wireframe `<DebugBox>`.

## Conventions

- Files use named exports, except `WeatherSceneContainer` and `App` which default-export.
- New `SimulationConfig` fields: add to `weather/types.ts`, default in `weather/config.ts` `DEFAULT_CONFIG`, populate from weather in the inline object, and plumb an override (with `"auto"`) if user-adjustable.
- Per-frame allocations: avoid in `useFrame`. Use `useRef(new Vector3())` / `useRef(new Color())` scratches and pre-allocated `Float32Array` for positions.
- Textures & `ShaderMaterial` instances created in `useMemo` / `useEffect` must be disposed in cleanup when the effect is re-created (none of the current effects re-create materials, but add a dispose path if you do).
- Wind compass labels come from `services/weatherFormatter.ts::toCardinal()` (16-point compass, shared by CurrentWeather and WeeklyForecast). Don't duplicate.

## Things that are NOT bugs

- `.claude/` and `.cursor/` are gitignored — local editor state only.
- `tsconfig.node.json` (for `vite.config.ts`) and `tsconfig.tsbuildinfo` / `tsconfig.node.tsbuildinfo` (incremental-compile caches) are all required/harmless artefacts of `tsc -b`. Don't delete them.
- The Vite `>500 KB` chunk warning is Leaflet + three.js; not worth chasing until the scene grows to justify code-splitting.
- The pre-baked cloud noise texture spends ~30 ms CPU on first scene mount. Users see the box + sky render immediately; noise texture populates once before any `CloudLayer` frame runs.
