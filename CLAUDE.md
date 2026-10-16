# CLAUDE.md

Project onboarding for Claude Code. Claims here can go stale — if something conflicts with the code, trust the code and update this file.

The human-facing README.md covers features, demo link, UX, and tech stack — don't duplicate it. This file captures the shape of the code and the non-obvious things; the history of how each choice was reached is in CHANGELOG.md.

## Stack & running

- React 19 + TypeScript 7 (native `tsc`, strict), **Vite** 8 (Rolldown). Sass via `sass-embedded`.
- Three.js via `@react-three/fiber` + `@react-three/drei`, `three.quarks` (particles), `suncalc` (sun/moon). Clouds are our own volumetric raymarch (`layers/clouds/`).
- **Banned libraries**: `@react-three/postprocessing` / `postprocessing` (every compose pass adds overdraw), `@takram/three-atmosphere` / `@takram/three-clouds` (full-res volumetrics too heavy for mid-tier phones), drei `<Cloud>` / `<Clouds>` (sprite overdraw, flat look), `r3f-perf` (pulls a second, incompatible drei).
- Node 24 (`.nvmrc`), **pnpm** 12 (`packageManager`; `corepack pnpm …` works without a global install). All deps pinned exact. `pnpm-workspace.yaml`: the `quarks.core` override (three.quarks depends on `quarks.core: *`), `allowBuilds` (`@parcel/watcher` denied its compile script) and `minimumReleaseAgeExclude` entries pnpm writes for very recent releases.
- Scripts: `pnpm start` / `pnpm dev`, `pnpm build` (`tsc -b && vite build`), `pnpm preview`. No tests, no lint/format scripts.
- No env vars. Open-Meteo and Nominatim are called directly from the browser.
- Fonts: **Chakra Petch** (body) + **Geist Mono** (small labels), Google Fonts. OKLCH design tokens in `src/index.scss`.

## Data flow (one path, memorise it)

```
WeatherQuery {q | lat,lon}
  → hooks/useWeather.ts (fetch, cancel superseded, min loading, error text, 15-min silent refresh)
  → services/weatherService.ts: fetchWeather
      → geocoder.ts   (Open-Meteo search; reverseGeocode via Nominatim)
      → weatherApi.ts (Open-Meteo /forecast — current incl. cloud_cover_low/mid/high, rain/showers/snowfall,
                       gusts, visibility, and the atmosphere fields: boundary layer, CAPE/LI, freezing level,
                       radiation, 850/300 hPa wind, cloud_cover + geopotential height at PRESSURE_LEVELS; hourly; daily)
      → openMeteoMapper.ts → WeatherData { current, atmosphere?, daily[], hourly[] }
  → weather/sceneParams.ts: mapToSceneParams(weather, units, overrides)
      SI units (units.ts); WMO traits from codes.ts::codeInfo(); precipitation from precip.ts;
      continuous values only — no time-of-day phases; then overrides.ts::applyOverrides ("auto" = pass through)
      → weather/cloudPhysics.ts: physicsFor(scene) → params.cloudPhysics
        (base, top, drawn deck, layer heights, optical depth, convection, winds aloft)
  → <WeatherSceneContainer> → <WeatherScene params quality parallax …/>
      (App passes its effectiveParams; quality tier and parallax are view props, resolved from the pins)
  → SceneRoot: <SceneDriver> turns params + clock into per-frame SceneSignals;
    every layer reads params (React props) + signals (inside useFrame)
```

`App.tsx` owns the top-level state (query, units, overrides, debug tools, map drawer) and the `.shell` layout; fetching lives in `useWeather`, the F7 / 5-tap toggle in `useDebugToggle`. `units` goes to the scene because Open-Meteo returns mph/°F in imperial mode.

## Directory map

```
src/
  App.tsx                       top-level state + layout
  hooks/                        useWeather, useDebugToggle (F7, or 5 taps on the footer status), useGlassSpotlight,
                                useLiveClock (location time, 15 s), useDialogFocus (modal panels: focus in, Tab trap, Escape, focus back)
  services/                     weatherService (fetchWeather, places cached per query), weatherApi (+ requested field lists), geocoder,
                                openMeteoMapper (API → WeatherData), errors
  utils/                        format.ts (display: times, °, speeds, UV, compass, coords), math.ts (clamp, smoothstep, lerp)
  weather/
    sceneParams.ts              WeatherData + units → SceneParams (fromWeather, DEFAULT_SCENE, mapToSceneParams)
    overrides.ts                SceneOverrides, key set, isOverridesDirty, pinned, applyOverrides (precipitation / cloud steps)
    precip.ts                   PrecipState, gauge/code → rates (fallbacks), finalizePrecip (flags only where something falls)
    fog.ts                      visibility thresholds (fog, fog-code cap, rime cap, clear default)
    frost.ts                    getFrostAmount, hasDiamondDust
    cloudPhysics.ts             physicsFor(scene) → deriveCloudPhysics: convection, base, top, layer heights (drawn deck),
                                optical depth, winds aloft; deckCover (drawn shell) vs skyClosure (unweighted), deckClosing, TWO_STREAM_K
    scenePresets.ts             debug presets — the weather catalogue, one per row, with what each shows
    codes.ts                    the WMO table: label, kind, intensity, flags, cover fallback (scene, labels, icons)
    units.ts                    metric/imperial: API unit names, labels, conversions to SI
    types.ts                    API/domain types
  components/                   UI only (navbar, map-picker, weather cards, loader, debug-menu, icons.tsx);
                                debug-menu = shell + sections + fields (OptionButton, NumericField, FlagChip) over a DebugContext;
                                weather/current = hero + HeroStats (data array) + SunArc; map-picker/hooks = drawer resize, slow tiles
  styles/                       _glass.scss (liquid glass + cursor reveal mixins), _tokens.scss (breakpoints, label mixin, ease, z-scale)
  weather-scene/
    WeatherSceneContainer.tsx   error boundary around the scene (the UI's entry point)
    WeatherScene.tsx            <Canvas>, quality tier + PerformanceMonitor, SceneRoot (mount order!)
    core/
      worldFrame.ts             world convention: facing S/N, compassToWorld, windVelocity, heights, scales, DEFAULT_PARALLAX
      viewVolume.ts             frustum-derived spawn volumes (ViewFrame, halfWidthAt, topAt/bottomAt, skyPatch, …)
      sceneSignals.tsx          per-frame shared state (context; mutable — never React state); NO_CLOUD_COVER
      SceneDriver.tsx           per-frame driver: clock, suncalc (throttled), gusts, winds aloft; calls the two below
      celestial.ts              pure: real → display direction of sun/moon (squeeze, gutters, pairing), projectToScreen, placeBillboard
      skyLight.ts               pure: day/night factors, overcast/cloudFill, haze, horizon + light colours → signals
      UiBacklight.tsx           scene brightness → `--scene-light` CSS var on <html> (drives the glass UI)
      quality.ts                QUALITY_TIERS, potato / low / medium / high budgets
      constants.ts              RENDER_ORDER, TONE_EXPOSURE, MAX_DT, CELESTIAL_DISTANCE, SUN_DISC_DEG
      palette.ts                every scene colour (haze, sun, ambient, sky veil, cloud light, deck, bolt, frost, stars, moon)
      CameraRig.tsx             static camera + subtle parallax (gyro / pointer); LOOK_TARGET
      useCoverColumn.ts         measures the page's content column ([data-scene-cover]) → ViewFrame.coverHalf
      FrameRateGate.tsx, useDeviceOrientation.ts, useIsMobile.ts
      noiseTexture.ts           module-scoped tileable FBM 256×256 singleton
    layers/
      SkyLayer.tsx              drei <Sky> (Preetham) driven by the displayed sun
      SkyGrade.tsx              night gradient + overcast + horizon haze/fog + ground + flash (1 draw)
      SunGlow.tsx               additive rim + halo round the displayed sun (display space, under the clouds)
      LensFlare.tsx             full-screen lens flare of the sun / a bright moon (ghosts, ring, spikes), put out by clouds
      StarField.tsx             points only inside the frame's sky patch, continuous opacity
      Moon.tsx                  moon.jpg disc with the real phase, lit limb towards the on-screen sun
      clouds/                   VolumetricClouds (state, easing, per-frame wiring), cloudPasses (materials + targets),
                                cloudLighting (pure: key light, ambient, adaptation, haze), godRays (strength + pass),
                                cloudDrift (drifts wrapped by the noise tile periods), shellTargets (weather → shell incl. gloom
                                and haze distance, pure; withDerived), cloudNoise3D (generator + cache), fullscreenPass
      CloudDeck.tsx             "potato"-tier fallback: flat world-space plane at DECK_Y
      precip/                   three.quarks: Precipitation (quarks lifecycle, live updates), kinds.ts (KINDS table,
                                weather → specs, pure), ViewVolumeEmitter, textures
      Thunder.tsx               strike scheduler + one persistent LineSegments2 geometry, drives signals.flash
      DiamondDust.tsx           drei <Sparkles> when weather/frost.ts::hasDiamondDust
      FrostGlass.tsx            procedural frosted pane (shaders/frost), grows 0 → −20 °C
    shaders/                    GLSL strings (skyGrade, sunGlow, lensFlare, stars, moon, cloudDeck, cloudNoise);
                                chunks.glsl.ts = shared helpers (noiseRank, remap, IGN, BILLBOARD_VERT, glslColor/glslFloat)
      clouds/                   the volumetric passes: march (+ density, lighting, layers chunks), resolve, rays, composite; common
    debug/                      PerfProbe + perfStats (renderer.info)
```

## World convention & "only where the camera looks"

- Camera at the origin, looking down **-Z**, pitched up 22°, FOV 50: the frame spans −3°…+47° — a thin horizon strip (sunrise/sunset stay in frame) and mostly sky. **-Z = south** on the northern hemisphere and **north** on the southern one (`facingFor(lat)`), so the sun always crosses the frame. +X is the viewer's right. Scene azimuths are radians from south, + towards west; suncalc 2 (degrees, azimuth clockwise from north) is converted once in `SceneDriver` (`azimuthFromCompassDeg`). `compassToWorld` / `windVelocity` in `core/worldFrame.ts` are the only places bearings become vectors — wind FROM the west drifts clouds **leftwards**, from the north **away towards the horizon**.
- **Real vs display direction.** Sun and moon use the real altitude for light and colour (`signals.sunAlt`/`sunAltDeg`, `day`, `night`, `warmth`) but a **display direction** squeezed into the frame (`core/celestial.ts`):
  - Azimuth: with side gutters beside the content column (`[data-scene-cover]` on `.stack`, measured into `ViewFrame.coverHalf`) the body runs in them — morning left, afternoon right — crossing behind the cards within ±16° (`CROSS_SHARE`; the moon ±2.7°, `MOON_CROSS_SHARE`, so its night transit stays visible), solved for the pitched camera so a high body keeps its screen x. Gutters under 0.1 NDC (phones) fall back to ±135° → 80 % of the half-frame.
  - Altitude: top × sin(alt) above the horizon (zenith 5° under the top edge), linear below so Preetham's dusk isn't cut short.
  - **Pairing** (`pairedMoonAzimuth`): with both up on the same side and the moon nearer the middle, the moon is mirrored to the other side (eased by both being up and by how much nearer the middle it is; continuous through the middle).
  - The sky glow, the sun disc (`SUN_DISC_DEG` 1.4°, patched into `<Sky>`), `<SunGlow>`, the moon and the lens flare use the display direction; the Preetham disc and `<SunGlow>` follow the REAL sun's visibility (`uDiscVisible`, +0.5° → −1°). A daytime moon fades under 12° and needs ≥ ~20 % lit.
  - The clouds' light march uses `signals.sunLightDir` / `moonLightDir` (display azimuth, **real** altitude — the squeezed one lights every cloud almost horizontally), crossfaded by energy at dusk; their phase function (`uPhaseDir`) uses the full display direction so the silver lining sits round the visible disc.
- **Lens flare** (`<LensFlare>`): one full-screen additive pass per source in display space — six aperture ghosts along the source → centre axis, a faint rainbow ring, six spikes. The vertex shader samples `signals.cloudCover` round the source (the resolved cloud target; `NO_CLOUD_COVER`, a transparent 1×1, without one), so cloud over the sun puts it out without a readback. Moon flare only at night, ≥ 40 % lit.
- Every layer spawns only inside volumes from `core/viewVolume.ts`, derived from the BASE camera frustum plus a margin covering the parallax range. Drifting things wrap at volume edges that are off-screen or deep in the horizon fog. Precipitation particles get a life that ends exactly when they leave the frame (`ViewVolumeEmitter`). The volumetric clouds need no volume: their cost follows the cloud target size.

## Scene rendering pipeline

No EffectComposer, no post-process. The only offscreen work is the volumetric clouds: march + resolve every frame, god rays when the sun is near the frame, plus the one-off 3D noise generation. Typically 5–9 draw calls.

**Volumetric clouds** (`layers/clouds/`, `shaders/clouds/`):
- **Shell.** A spherical shell over a curved Earth, in metres; base/thickness/coverage/type (stratus → cumulus → cumulonimbus) from `params.cloudPhysics` via `shellTargets()`. Coverage = `deckCover` = max(low, mid × 0.85) — high cover is the cirrus; total only when no layer explains it. The drawn deck is `deckBaseM`–`deckTopM`: the low cloud, or the mid band −350…+450 m when `midDeck` (mid > 1.3 × low and > 0.15, convection < 0.5, and low < 0.3 or no pressure level below 2.5 km with ≥ 5 % cloud — a sub-grid low layer); its τ is the drawn deck's. `baseM`/`topM` stay the low cloud (debug pins, readout, the bolt). With `midLayer` (deck stays low, mid ≥ 10 %) the mid cover is a thin 2D sheet at `midAltM` (cells ×2.5, alpha ≤ 0.8, half the cirrus drift) and the shell's coverage is low alone. Cirrus is a 2D layer at the 250–300 hPa cloud height (default 8.5 km).
- **Cloud physics** (`weather/cloudPhysics.ts`, every input has a fallback):
  - base = LCL ≈ 125 m × (T − Td), under the inversion for a stratiform deck, ≤ 120 m in fog;
  - stable top = boundary-layer height when the deck is inside it (≥ 100 m thick), raised to the highest cloudy low level or capped at the first clear level above the base, ≥ base + 1.5 km when precipitating;
  - convection from CAPE (≈ 4.2 m per J/kg, ≤ 11.5 km) damped by LI; **CAPE is only potential**: without showers/thunder convection ≤ 0.6 and the top ≤ max(base + 800 + 0.6·CAPE≤2000, highest level with ≥ 5 % cloud + 300 m);
  - layer heights from pressure-level `cloud_cover` × `geopotential_height` (minus elevation);
  - τ from thickness (16/km broken → 30/km closed, 35/km precipitating, × 1.6 thunder), blended by day (log space) towards τ inverted from the clearness index (shortwave / TOA ÷ clear-sky 0.74 dimmed by air mass; Eddington T = (2/3 + μ0)/(4/3 + (1 − g)τ); attributed to the unweighted `skyClosure`), trusted as the deck closes (0.5 → 0.9) and fading with a sun under ~20°; τ ≥ 3 (≥ 10 closed, ≥ 15 precipitating);
  - density = τ / (thickness × `SHELL_FILL` 0.35, the measured mean ∫density dz per unit cover).
  - Debug pins of the sky drop the measured radiation and pressure-level evidence (`measuredSky`); wind pins drop the winds aloft.
- **Density.** Perlin-Worley shape × height gradient, remapped by a scrolling cover field, eroded by Worley detail (wispier above the freezing level). **Coverage is calibrated:** the cover/cirrus noise mixes are near-normal and narrow (cover μ 0.624 σ 0.050, its large-scale part μ 0.659 σ 0.056, cirrus μ 0.490 σ 0.081 — re-measure if `cloudNoise.glsl` changes), so `noiseRank()` (logistic CDF) gives an even rank and the top `uCoverage` share is cloud, with a wide ±0.18 edge (`COVER_EDGE`, rounds the tops) gated by the large-scale rank (`ISLAND_REACH`, no floating islands) — `coverMask`. The cover field drifts with height (rims lean, no vertical curtains); towers narrow with height; anvils spread round each cell only; closing decks keep a lumpy base (`density()`'s `column` out parameter). **Feature scale:** noise lookups use metres ÷ (base + thickness/2) / 1200 m, clamped 0.2..1, so a low deck keeps cumulus-sized cells on screen. Noise: a tileable RGBA 3D texture rendered slice by slice on the GPU (`getCloudNoise3D`, cached per renderer and size).
- **Lighting.** Light march towards the light: growing steps through a near cone (≤ 1 km), then one long step for the rest of the reach, start jittered; Beer + direction-aware powder, 3-lobe HG, depth-weighted scattering octaves floored by a two-stream diffuse term (∝ 1/(1 + `TWO_STREAM_K`·τ above), τ above scaled by the column's lumpy-base factor so thin patches are brighter); height ambient × (1 − storm gloom); daylight adaptation under a closed deck ((1 + K·τ)^0.35, ≤ 2.2, horizon haze not raised); aerial perspective (`aerial()`); lightning glow from `signals.flashPosition`. The sun lights cloud bases until ~6° under the horizon.
- **Cost control.** Cloud target at `budget.volumetric.scale`; the march covers one pixel per 2×2 block per frame (jitter = IGN rotated by the golden ratio). Adaptive march: cheap 3× steps through empty air, back up on a hit, fine steps ~2 % of the distance (≥ thickness / `steps`, ≤ 900 m), `steps` caps the lit samples. The resolve reprojects history by view direction, clips it to mean ± 1.5σ of the 3×3 fresh texels, blends 0.3 marched / 0.06 upsampled. Weather changes don't reset history: the primary shell fields ease (`SHELL_EASE`, ~1 s; density and feature scale re-derived, `withDerived`). Low/mid clouds drift with 850 hPa in noise space, cirrus with 300 hPa, × `CLOUD_TIMELAPSE` 4; drifts reach the GPU wrapped by their noise tile periods (`cloudDrift.ts`).
- **God rays** (half × half): a radial march towards the on-screen sun over the resolved transmittance. Only thick cloud occludes (alpha 0.5 → 0.9); the clear share is raised to `SHAFT_CONTRAST` 2. **r** = added light, fading in to 0.35 frame heights from the disc, 0.15 → 1 with the disc's cover, soft-capped at +0.35; **g** = shadow lanes (air brightness × blocked share, from 0.03–0.2 out), dimming the sky (not the clouds) through the composite alpha, ≤ 0.25. 4-tap tent read. Strength: sun above −1° and near the frame, cover ≥ ~0.1 (`RAY_CLEAR_FLOOR` glare otherwise), raised by haze, killed by fog.
- **Composite:** full-screen quad, renderOrder 2. Un-premultiplies before tone mapping / sRGB (see gotchas), writes premultiplied: encoded cloud × alpha + rays in display space; alpha = cloud + shadow lanes × (1 − alpha).

Mount order in `SceneRoot` is load-bearing (R3F runs useFrame callbacks in subscription order):

1. **`<FrameRateGate fps={budget.fps}>`** — pairs with `frameloop="demand"`; 60 fps (30 on `low`).
2. **`<CameraRig>`** (static camera + parallax).
3. **`<SceneDriver>`** — this frame's `SceneSignals` (clock, celestial, colours, haze, gusts, winds aloft and drifts). Then **`<UiBacklight>`** (`--scene-light`).
4. No three.js lights: every material is a custom shader or unlit; the clouds take light colour/ambient from `SceneSignals`.
5. **`<SkyLayer>`** (−2) → **`<SkyGrade>`** (−1) → **`<SunGlow>`** (−0.5) → **`<StarField>`** (0) → **`<Moon>`** (1).
6. **`<VolumetricClouds>`** composite (2) — or **`<CloudDeck>`** (2, own exp² fog) on `potato`. No scene fog.
7. **`<Precipitation>`** (4) → **`<Thunder>`** (5, top at the cloud base) → **`<DiamondDust>`** (6) → **`<LensFlare>`** sun + moon (7, after the clouds: they read this frame's `signals.cloudCover`) → **`<FrostGlass>`** (30).
8. Debug: `<PerfProbe>` + three drei `<Stats>`.

`<Canvas>`: `camera={{ position: [0, 0, 0], fov: 50, near: 0.5, far: 4000 }}`, `dpr={[1, budget.dprMax]}`, `gl={{ alpha: false, antialias: !isMobile }}`, `toneMappingExposure = TONE_EXPOSURE` (0.5, set in `onCreated`, tuned for Preetham).

## Quality tiers

`useIsMobile()` picks the initial tier (mobile → `low`, desktop → `high`); drei `<PerformanceMonitor>` steps it down when fps drops below 75 % of the cap (not while a tier is pinned); the debug menu can pin it. Budgets in `core/quality.ts`:

| | high | medium | low |
|---|---|---|---|
| DPR max / fps cap | 1.5 / 60 | 1.25 / 60 | 1 / 30 |
| Cloud target scale / steps / light steps | 0.5 / 64 / 6 | 0.4 / 48 / 5 | 0.33 / 32 / 4 |
| Cloud noise / max distance | 128³ / 60 km | 96³ / 50 km | 64³ / 40 km |
| God-ray samples | 32 | 24 | 16 |
| Rain / snow / hail particles | 1800 / 1100 / 260 | 1000 / 650 / 150 | 450 / 300 / 80 |
| Stars / sparkles | 1600 / 320 | 1000 / 180 | 500 / 90 |

Below `low` sits **`potato`** (1 DPR, 30 fps, smaller particle budgets, flat `<CloudDeck>` instead of the raymarch), reached only when `low` can't hold 30 fps.

## Non-obvious gotchas

- **Tone mapping.** Exposure 0.5 for `<Sky>`; the cloud composite tone-maps with it too, so cloud radiance (light, ambient, haze ×1.4) is in those pre-tonemap units. Anything that must keep its authored colour sets `toneMapped: false`. **three.quarks drops `toneMapped` when it builds its batch materials**, and drei `<Sparkles>` tone-maps — both are patched at runtime, or rain and snow render grey.
- **Custom ShaderMaterials end with `#include <colorspace_fragment>`** — colours are `THREE.Color` (linear). GLSL colour literals come from `palette.ts` through `glslColor()` (linear components).
- **quarks particle textures are DataTextures with white RGB + alpha** (canvas textures came out premultiplied on some GPUs); no colour space — quarks' shader doesn't convert.
- **quarks never drops an emptied batch**, so `<Precipitation>` builds a fresh `BatchedRenderer` per rebuild and disposes the old one's batches. **Emitters must hang under a `Scene`** or the system disposes itself. quarks clamps delta to 0.1 s; there's no `maxParticle` — visible count = emission rate × mean life (`ViewVolumeEmitter.meanLife`).
- **Stretched billboards:** streak length = |velocity| × `speedFactor` × size; `speedFactor: 0` makes rain invisible. Rain and hail spawn from 3 units out (flakes 1.5) so no drop slashes across the frame.
- **drei `<Sky>` is a box** (`distance` 3000) pinned to the far plane via `z = w`; a camera that leaves it sees black.
- **Cloud noise is generated once**, per renderer and size (a new WebGL context regenerates it). The 2D FBM (`getCloudNoiseTexture()`, ~30 ms CPU) is a lazy singleton shared by the potato deck and the frost; never pass it through `UniformsUtils.merge` (clones it).
- **`frameloop="demand"` + `FrameRateGate` is mandatory**, or the scene renders at monitor rate. The gate renders every N-th rAF tick — never gate on `elapsed >= 1000/fps` (rAF jitter drops random frames, and `PerformanceMonitor` lowers the tier).
- **Frost is a scene layer, not DOM.** `getFrostAmount` eases 0 at 0 °C → 1 at −20 °C, × humidity, ≥ 0.35 for freezing rain / rime; `FrostGlass` grows and melts towards it, reach ≤ 0.32 of the short side, opacity ≤ ~0.55 — the middle stays clear. The noise is mip-biased and domain-warped so the tile never repeats visibly.
- **Thunder uses the R3F clock only** (`performance.now()` would offset the first flash by the page's age). Bolts reuse one preallocated line geometry: drei `<Line>` disposes its material whenever the points change.
- **The disc, its glow and its flare fade on one ramp per body** (`signals.sunDisc` / `moonDisc`, real altitude). Light through the air (god rays, moonlight on the clouds) has its own ramps.
- **Scene time**: live = `Date.now()` + suncalc. Open-Meteo (`timezone=auto`) returns location-local ISO strings without an offset; parse them in the location zone (`localSeconds`), never the browser's.
- **Cloud noise lookups are `textureLod(…, 0)` (`noise3()`).** Implicit-derivative `texture()` in the march's data-dependent loops is undefined, and ANGLE's D3D11 backend (Chrome on Windows) returns an empty ray wherever the march breaks out early — every opaque nearby cloud vanishes. Keep it for any new lookup in a loop.
- **Never sRGB-encode premultiplied colour.** Encoding inflates thin edges (sRGB's linear toe is ×12.92) into white outlines; the composite divides by alpha first, then tone-maps/encodes. The same toe is why display-space layers (sun glow, flare, rays) are never encoded.
- **`gl.render()` inside `useFrame` resets `renderer.info`** — `PerfProbe` disables auto-reset and resets once per frame.
- **Headless/software GL (SwiftShader) runs at ~3–10 fps**, so `PerformanceMonitor` drops to `potato` — pin the tier when taking screenshots. The 128³ noise takes seconds there.
- **The current weather_code and cloud_cover disagree by design** (the code is the coming hour's step, the cover is interpolated). `codes.ts::codeForCover()` re-derives pure cloud codes 0–3 from the shown cover (< 20 / 50 / 80 %); the scene never reads the code for clouds. **No layer is drawn above the measured total** (`fromWeather`): no overlap lets one layer cover more sky than all together. MET Nordic (`best_match` in Scandinavia and the Baltics) pairs a corrected total with raw layers that can contradict it (low 100 % under a total of 18 %); the total wins, as in the label. A broken deck still looks fuller than its percentage towards the horizon — slant lines of sight cross several cells, as in a real sky; that isn't compensated.
- **Twilight.** The horizon haze stays warm below the horizon and dims (× 0.45 by −8°) until night takes over — keyed to the sun's altitude, not `warmth` (back to 0 by −8°). `<SkyGrade>` brings its night gradient in from sunset (≤ 75 % by −6°, blue hour).
- **Overcast at dusk.** The haze and sky veil under an overcast take a dark warm tint keyed to `signals.lowSun` (0 at ≥ 10° … 1 at the horizon), then night takes over.
- **`signals.overcast` vs `signals.cloudFill`.** `overcast` (greys the sky and horizon, hides stars/moon) starts only at 80 % low / 85 % low-or-mid cover — a broken deck's gaps are blue. `cloudFill` (from 55 %) feeds only `<UiBacklight>`: the frame never shows the zenith, so a broken deck already fills most of it.
- **`SceneErrorBoundary` silently renders `null`** on error (and logs it). If the 3D scene vanishes in dev, open DevTools.

## UI conventions

- **Liquid glass** = `@include liquid-glass` (`styles/_glass.scss`: hero, hourly, forecast tiles, navbar controls, footer pill, loaders). Adaptive: `--scene-light` (0 night … 1 white overcast/fog at noon, written by `<UiBacklight>`, fallback 0.4) darkens the backdrop, thickens a smoke tint, firms up `--fg-dim/mute/faint` + `--stroke`, and fades in a text halo. Hover/active raise `--glass-lift` (registered `@property`, non-inherited) instead of replacing `background`. Blur is `--glass-blur` (16 px, 12 px ≤ 720 px).
- **Cursor reveal** on every boxed UI element: `@include glass-reveal` (liquid glass includes it). It sets `--glass-spot: 1`; `hooks/useGlassSpotlight.ts` writes `--mx`/`--my` once per frame to every such element within `--glass-reveal` (160 px, `:root`) of the cursor, parking the rest off-screen. The mixin's `::after` is a masked 1.5 px ring lit at that point, and `:hover` fades `--glass-glow` in. The mixin owns `::after` and sets `position: relative` (pass `null` if already absolute/fixed); components use `::before`. A component with its own `transition` list adds `$glass-glow-transition`. Replaced elements can't carry it. Mouse only.
- Full-height overlays use `100dvh` after a `100vh` fallback (mobile `100vh` hides the bottom under the browser bars). Under 440 px the map drawer is a full-width sheet. The brand is the two-line logo (`YET ANOTHER` / `WEATHER APP`; `DEBUG` / `MODE` in debug).
- Shared SVG icons in `components/icons.tsx` (`PinIcon`, `PIN_PATH`, `CLOUD_PATH`, `LineIcon`, `CloseIcon`, `WeatherIcon`). `WeatherIcon` is the one weather-code → icon mapping (day/night, sun/moon masked behind clouds, precipitation marks by type and intensity). Scaled shapes divide their stroke by the scale. No remote icons, no icon library.
- Small labels: `@include mono-label(size, spacing)` (Geist Mono, uppercase unless `$upper: false`); body and temperatures in Chakra Petch.
- Footer: a 2-row block inside `.stack` — `[status] … [attrib]`, then the centred GitHub pill.
- Hero arc and hourly chart: `preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`; arc progress via a `<clipPath>` rect (not `stroke-dasharray`); chart points and labels are an HTML overlay so they aren't stretched; SVG ids come from `useId`.
- **Loading** (`components/loader/`): `Spinner`, `LoaderPill` (stays mounted and fades; `large` for the viewport-centred refetch pill), `LoaderPanel` (first load). `App` tracks a `LoadSource` (`Navbar.tsx`) for the labels and the spinning control. On a refetch the cards' *contents* blur and fade while the glass stays intact — never put filter/opacity on a card or its ancestors (it cuts the backdrop blur), and keep `.stack > *` entrance animations on `backwards` fill. The map shows a pill only for tile loads slower than 250 ms.
- Shown data is rendered with `weatherUnits` (the units it was fetched in), not the toggle's `units`. Superseded fetches are cancelled in the effect cleanup.

## Debug menu & overrides

- **F7** toggles the menu (on phones: 5 quick taps on the footer status), even with an input focused. Escape closes the debug menu or the map drawer (the top one when both are open); both move focus in, trap Tab and give focus back (`hooks/useDialogFocus`).
- **Presets** (`weather/scenePresets.ts`) pin every weather key, one per catalogue row. "auto" clears exactly those keys; the highlight is derived from the pins.
- Setters go through the latest state (`onOverridesChange(prev => …)`), so two changes in one tick both land.
- Time: local-hour slider (location timezone) + date; a pinned time stops the live clock.
- Every override is a literal or `"auto"`. `isOverridesDirty()` drives the Navbar `DEBUG` badge over `OVERRIDE_KEYS` (from `OVERRIDE_KEY_SET`, a `Record<keyof SceneOverrides, 1>` — a missing key is a type error). Quality and parallax pins are view settings: App resolves them with `pinned()` into `<WeatherScene>` props.
- Auto-bumps in `applyOverrides`: precipitation *pinned* raises low cloud (≥ 0.85; showers ≥ 0.6; thunder ≥ 0.95) — measured weather keeps the model's cover (with only a floor in `fromWeather`: 0.25 under rain/snow codes, 0.35 under thunder); thunder/hail/drizzle/freezing/grains *pinned* without a rate bring a typical one; rime caps visibility at 400 m.
- Cloud physics row: base / top / CAPE / τ pins (τ "auto" = estimated once the sky is pinned), plus a readout of the derived physics, the drawn deck, winds aloft and frost %. Tools: quality tier pin, perf readout, ⚡ force lightning.

## Conventions

- Files use named exports; only `App` (imported by `index.tsx`) default-exports.
- New scene input: add it to `SceneParams` (+ `DEFAULT_SCENE`, `fromWeather`; `physicsFor` if the cloud physics reads it), a `SceneOverrides` key + `OVERRIDE_KEY_SET` entry + `applyOverrides` line, and to `CALM` in `scenePresets.ts` if it describes weather (plus what the presets that change it show).
- Pure logic stays out of frame loops and components (`celestial`, `skyLight`, `cloudLighting`, `shellTargets`, `kinds`, the weather modules); components and `useFrame` wire it.
- Per-frame values go through `SceneSignals` (written once in `SceneDriver`), not React state; derived ones (`sunAltDeg`, `sunLightDir`, `sunColorDisplay`, …) are published there, not re-derived. No allocations in `useFrame`.
- Materials, geometries and textures created in `useMemo` are disposed in an effect cleanup.
- Display formatting lives in `utils/format.ts`. Don't duplicate.
- Layer draw order from `core/constants.ts::RENDER_ORDER`, scene colours from `core/palette.ts`, display-space overlay flags from `DISPLAY_OVERLAY`, the frame delta cap from `MAX_DT`, shader constants shared with TS interpolated from one export.
- SCSS: breakpoints via `@include below($bp-tablet | $bp-phone)`, labels via `mono-label`, `$ease-out` and the `$z-*` scale from `styles/_tokens.scss`; colours are `:root` tokens (`--fg*`, `--fill*`, `--stroke*`, `--accent-warm`, `--danger`, `--panel`) and their tints `color-mix(in oklch, var(--token) N%, transparent)`, never a copied OKLCH literal.
- Comments state a why in one or two lines — no history ("before this it drew…"); the history goes in CHANGELOG.md.

## Things that are NOT bugs

- `.claude/` and `.cursor/` are gitignored — local editor state only.
- `tsconfig.node.json` and `tsconfig*.tsbuildinfo` are required/harmless artefacts of `tsc -b`. Don't delete them.
- The Vite `>500 KB` chunk warning is Leaflet + three.js (+ three.quarks); not worth chasing yet.
- The 2D noise texture spends ~30 ms CPU the first time frost or the potato deck shows.
- The `THREE.Clock` deprecation warning in the console comes from R3F/drei internals.
- `quarks.core` is not a dependency: `three.quarks` pulls it with `*`, pinned by the override in `pnpm-workspace.yaml`.
