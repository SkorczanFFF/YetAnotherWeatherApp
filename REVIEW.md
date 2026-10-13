# Code review — 2026-10-13

Scope: all of `src/` (~9.4k lines), `index.html`, `package.json`, as of the working tree (includes this session's uncommitted changes). Method: mechanical checks + four parallel reviewers (data layer · scene core & layers · volumetric clouds & precipitation · UI & styles) + manual verification of every finding marked **✔** (code read or reproduced). Line numbers are approximate after recent edits.

Categories: **bug** · **unused** · **dup** (redundancy) · **ssot** (single source of truth) · **over** (overengineering) · **comment** · **structure**.

## 1. Summary

The codebase is in good mechanical shape: `tsc --noUnusedLocals --noUnusedParameters` is clean, every export and npm dependency is used, all shader uniforms are wired both ways, no allocations in `useFrame`, every SCSS class and keyframe is referenced. The debt is elsewhere:

1. **A handful of real bugs**, two user-visible right now: sunrise/sunset/hourly/day labels are shifted by the browser↔location timezone difference (visible in the Ponte de Sor screenshot: sunrise 06:39 instead of ~07:39), and the map drawer resets the picked point / steals focus on unrelated re-renders.
2. **Knowledge spread across files**: WMO codes live in four places (and already disagree), units in three, render orders in ten, palettes duplicated with different values, tier lists in four.
3. **Files with several jobs**: `weatherFormatter.ts` (API mapping + code labels + display formatting), `App.tsx` (fetching + debug input + layout), `VolumetricClouds.tsx` (noise generator + weather mapping + renderer), `sceneParams.ts` (types + mapping + overrides + frost + sun helper).
4. **Comments**: many are essays or history narration that duplicate CLAUDE.md; a few are stale or wrong.

## 2. Bugs (ranked)

### P0 — user-visible or degrading over time
- **✔ bug — local times parsed in the browser zone.** `services/weatherFormatter.ts:88-90,166,182` — Open-Meteo is called with `timezone=auto`, so it returns location-local ISO strings without an offset; `DateTime.fromISO(x)` treats them as browser-local, and the UI then formats them with `setZone(location)`. Sunrise/sunset and the day arc (`CurrentWeather.tsx`), hourly chart labels (`HourlyChart.tsx:113`) and weekly day names are all shifted by the zone difference (a Poland browser viewing New York: sunrise 01:10, every day label a day early). Fix: `DateTime.fromISO(x, { zone: data.timezone })` everywhere, or request `timeformat=unixtime`. CLAUDE.md's "the scene doesn't use them" note is true but misses that the UI does.
- **✔ bug — cloud field slides when `featureScale` changes (introduced this session).** `shaders/volumetricClouds.glsl.ts:150` `xz = (p.xz - uWind) / uFeatureScale` zooms the noise around `uWind`, the accumulated, never-wrapped 850 hPa drift (`SceneDriver.tsx:168`). After an hour at 10 m/s, `uWind` ≈ 144 km, so a 0.1 change of the eased scale (any refetch or debug pin that moves base/thickness) slides every cloud ~14 km in a second, and it gets worse the longer the page is open. Fix: keep the drift in noise space, integrated in TS (`windNoise += v·timelapse/featureScale·dt`), and use `xz = p.xz / fs − windNoise`.
- **✔ bug — frame counter grows unbounded as a GLSL float.** `VolumetricClouds.tsx:363,444,460` → `glsl:356-360`. The jitter `floor(uFrame/4)·0.618` loses precision after a few hours (visible banding), and `mod(uFrame, 4.0)` breaks past 2²⁴ frames (~77 h at 60 fps), leaving pixels un-marched. That matters for a weather app left open on a wall screen. Fix: wrap `st.frame %= 4096` (a multiple of 4), or compute the jitter offset in JS.
- **✔ bug — MapPicker effect re-runs on every App render.** `App.tsx:247-251` passes a new `initialCenter` array literal on each render, and `MapPicker.tsx:145-161` depends on it. While the drawer is open, any App re-render (the 500 ms loading timer, a debug change) resets the picked point, overwrites `triggerRef` and steals focus. Fix: memoise the tuple in App, and run the focus logic only on `open` transitions.
- **bug — closed map drawer stays in the tab order.** `MapPicker.tsx:199-201`, `MapPicker.scss:3-10,48`: the closed drawer is only translated off-screen, so its buttons stay focusable inside an `aria-hidden` subtree. Fix: `inert={!open}`.

### P1 — wrong output in specific cases
- **✔ bug — "-0°".** `weatherFormatter.ts:197` and `WeeklyForecast.tsx:30-31` use `toFixed()`, so −0.3 °C renders as "-0°", while the hero uses `Math.round` and shows "0". Fix: one `formatDegrees` helper, `Math.round(v) || 0`.
- **✔ bug — PerformanceMonitor lowers the auto tier while a tier is pinned.** `WeatherScene.tsx:162-166`: `onDecline` always calls `setAutoTier`. Pin "high" on a slow GPU and unpinning later lands on potato. Fix: ignore declines while `params.quality` is set.
- **✔ bug — the lightning bolt core is greyed by the sky.** `Thunder.tsx:132`: the core `<Line>` has no `transparent`, so three renders it in the opaque pass, before the transparent SkyGrade and cloud composite, which then blend over it (renderOrder doesn't cross passes). Fix: `transparent` on the core line too.
- **bug — wrong intensities for WMO 56 and 77.** `codes.ts:37-38,57`: 56 (light freezing drizzle) → "heavy", giving 1 mm/h instead of 0.2; 77 (snow grains) → "heavy", giving 1.2 cm/h. The icon `LEVEL` table already disagrees with both. Fixed for free by the single code table (§9, phase 2).
- **bug — pinning an unrelated override adds rain.** `sceneParams.ts:434-436`: measured thunder or hail with rain = 0 (e.g. thundersnow) gets `baseRain = 6` as soon as *any* override is set, e.g. the hour. That breaks "pinning the time never changes the weather". Fix: bump only when thunder/hail/drizzle themselves are pinned.
- **bug — a CAPE pin wipes the thunder/showers convection floor.** `cloudPhysics.ts:202`: "Rain" preset (CAPE pinned) + thunder gives lightning over flat stratus. Fix: `max(smoothstep(cape…), thunder ? 0.85 : showers ? 0.55 : 0)`.
- **bug — cirrus lifts the shallow-convection cap.** `cloudPhysics.ts:239-241`: `highestCloud(levels, 0.05)` counts the 300/250 hPa levels, so any cirrus raises the non-showery tower cap to ~9 km, the exact artefact the cap exists to stop. Fix: count only levels below the high band, or the contiguous run above the base.
- **bug — sun→moon light switch pops at dusk, and the moon lights from its squeezed altitude.** `VolumetricClouds.tsx:403-416`: a hard branch gives a ~6× brightness jump plus a direction flip in one frame; `s.moonDir` is the display altitude, the same flaw already fixed for the sun. Fix: crossfade, and rebuild the moon direction from its real altitude.
- **bug — API error reasons are lost.** `weatherApi.ts:105-112`: Open-Meteo errors are HTTP 400 with `{reason}`, but `!response.ok` throws `statusText` first. `geocoder.ts:48-52`: a geocoder 5xx surfaces as "City not found". Fix: parse the body on non-ok responses; map 5xx to `API_ERROR`.
- **bug — hourly chart freezes at fetch time.** `HourlyChart.tsx:22-27`: "now" is picked when the data arrives and there is no periodic refetch, so after 3 h "Next 12 hours" starts 3 h in the past. Fix: periodic refetch (15–30 min), which also refreshes stale current conditions.
- **bug — `hasSplit` uses `!== undefined`.** `sceneParams.ts:292-295`: `null` rain/showers/snowfall count as a split, so measured precipitation under a dry code is dropped. Fix: `!= null`.

### P2 — robustness, dev-only, rare
- Noise cache is keyed by size only, not renderer (`VolumetricClouds.tsx:65`): an HMR or context-loss remount reuses a texture from a dead context, and the clouds vanish. Key by `gl`.
- Shell base has no floor (`VolumetricClouds.tsx:150`): `midAltM − 350` or a debug base of 0 puts the camera inside the shell. Use `max(base, 30)`.
- Possible stale history for one frame after target rebuild (`VolumetricClouds.tsx:331-333`, invalidated in a passive effect). Compare targets in `useFrame`.
- `BatchedRenderer` and its batch materials are never disposed on unmount (`Precipitation.tsx:184`).
- Precipitation systems are rebuilt on small rate changes (`Precipitation.tsx:191-193`: the key includes fall speeds, colour and sway), which causes a CPU spike and a visible pop. Key on kind only and mutate the emitter options live.
- Likely shader recompile per lightning strike: drei `<Line>` disposes its material when `points` change (`Thunder.tsx:103`). Use a persistent `LineSegments2`, updated in place.
- Stars re-randomise on every resize or aspect change (`StarField.tsx:32-57`, unseeded `Math.random`).
- iOS orientation permission resolving after unmount leaks a listener (`useDeviceOrientation.ts:79-81`).
- Light-step loop silently capped at 8 in GLSL (`volumetricClouds.glsl.ts:204`), whatever the budget says.
- Scene error boundary never recovers and never logs (`WeatherSceneContainer.tsx`).
- `/effects/moon.jpg` is an absolute path (`Moon.tsx:26`) and breaks under a sub-path deploy.
- Accessibility:
  - °C/°F buttons lack `aria-pressed` (`Navbar.tsx:153-166`).
  - Confirm button has white text on `--accent-warm`, likely below AA contrast (`MapPicker.scss:315`).
  - Debug dialog: the role sits on the backdrop, there is no Escape handler, and its labels are unassociated.
- To verify: `current.precipitation/rain/showers/snowfall` may be 15-min sums (`interval = 900`). If so, mm/h is under-read 4× (`sceneParams.ts:297-306`). Check the Open-Meteo docs.
- Reverse-geocode failure shows "Warsaw, Europe" (country = timezone prefix) (`weatherFormatter.ts:95`).

## 3. Unused code

- ✔ **Hourly `precipitation_probability` and `weather_code`**: requested, formatted and typed, never read; the chart reads `time` and `temp` only (`weatherService.ts:79`, `weatherFormatter.ts:181-186`, `types.ts:29-35`). `forecast_hours: 25` where 13 would do.
- Fields typed but never read:
  - `current.time`, `timezone_abbreviation`, `current_units`, `daily_units` (`weatherApi.ts`).
  - `GeocodingResult.id/country/timezone` (`geocoder.ts`).
  - `CloudPhysicsInput.clouds.total` (`cloudPhysics.ts:63`).
- `getWeatherData(endpoint, …)` is only ever called with `"forecast"`.
- `NETWORK_ERROR` is only thrown inside `reverseGeocode`, whose only caller swallows every error, so the try/catch wrapping there is dead too (`errors.ts`, `geocoder.ts:96-148`).
- `getSunAltitude` (`sceneParams.ts:554`) is a one-line suncalc wrapper with one caller (DebugMenu), which already imports suncalc.
- SceneSignals:
  - `facing` is only used inside SceneDriver (`windVelocityLow` is now read by VolumetricClouds for the noise-space drift; `windOffsetLow` is left to CloudDeck).
  - The initial colours/vectors in `createSceneSignals` are overwritten on frame 1 (and repeat SceneDriver's hex values).
- `FrameRateGate` default `fps = 60`: the only caller always passes it.
- Constant uniforms that could be GLSL consts: `uTint` (Moon), `uNightZenith/uNightHorizon` (SkyGrade), `uFadeFar` (CloudDeck), `uEarthR`.
- `// eslint-disable-next-line` in `VolumetricClouds.tsx:277` — there is no ESLint in the project.
- UI:
  - `logo192.png` is referenced in `index.html:15` but doesn't exist.
  - `browserslist` in `package.json` is a CRA leftover.
  - `react-toastify/dist/ReactToastify.css` is imported although v11 injects its CSS itself.
  - Optional Navbar props are always passed.
  - `useId().replace(/:/g, "")` is a no-op on React 19.2.
  - `WeatherIcon` `strokeWidth` prop is never passed.
  - Single-child wrapper elements: `.hero-head`, `.sun-end`, `.tools`, a bare `<g>`.
- `FOG_MAX_VISIBILITY_M` light/heavy entries are unreachable (45/48 both map to "moderate").
- Over 13 types are exported but used only in their own file (harmless; un-export for a tighter API).
- `quarks.core` is not imported directly, but it is deliberately pinned: `three.quarks` depends on `quarks.core: *`. Keep it, and document it.

## 4. Redundancy

- **WMO intensity**: `codes.ts` and `icons.tsx` `LEVEL` (they disagree on 56 and 77). `getCodeTraits` turns `EffectType` straight back into booleans, and `Math.floor(code)` runs twice.
- **Math helpers**:
  - `clamp01` is defined twice (`sceneParams.ts`, `Precipitation.tsx`).
  - `cloudPhysics.ts` has its own `clamp`/`smoothstep`/`lerp`, and its `smoothstep(x, e0, e1)` argument order differs from `MathUtils.smoothstep`. That is a trap when moving code.
  - Hand-rolled clamps in `useDeviceOrientation.ts` and `noiseTexture.ts`.
  - `Math.min(delta, 0.1)` appears in 4 files.
- **GLSL**: `noiseRank` (volumetric + deck); the cirrus streak/veil formula with identical magic numbers (volumetric + deck); `remap` (volumetric + noise generator); FBM weights `0.625/0.25/0.125` ×3.
- **Deck cover formula** `max(low, mid·0.85)` appears in CloudDeck and shellTargets, while SceneDriver uses `max(low, mid)`.
- **Fog base clamps**: `cloudPhysics.ts:218` (fog → 120 m) and `shellTargets` (vis < 800 → 150 m) use different triggers and values.
- **Precipitation**: six near-identical spec literals; `initialMeanLife` repeats `sampleDistance` maths; the snow atlas needs `size === TILE` but keeps two constants.
- **Material/dispose boilerplate** repeated in 5 layers; `noiseTexture` assigned "after merge" in FrostGlass, which doesn't merge.
- `uInvProj`/`uCamWorld` are copied into two materials every frame instead of sharing the uniform objects.
- **UI icons**: the close "X" is duplicated (DebugMenu, MapPicker); there are three different sun drawings (logo, UV stat, `WeatherIcon`); the same SVG attribute set appears ~15×; 8 hand-written stat blocks.
- **UI formatting**:
  - Temperature rounding is done three ways.
  - Coordinates are formatted at 2, 3 or 4 decimals in four places.
  - `formatGmtOffset` lives in App.
  - `HourlyChart` re-implements `formatToLocalTime`.
- **SCSS**:
  - The mono label recipe is re-declared ~12×.
  - `position: relative` repeated after `liquid-glass`.
  - DebugMenu repeats inherited `color`/`font-family` 5×/3×.
  - The 720 px queries replace `minmax(0,1fr)` with `1fr`, which can overflow.
- `DEFAULT_PARAMS` writes temperature and dew point twice. Minor simplifications: `codes.ts:57` `|| c === 57`, `cloudPhysics.ts:198` ternary.

## 5. Single source of truth

| Fact | Defined in | Fix |
|---|---|---|
| WMO codes (label, intensity, flags, cover fallback, icon) | `codes.ts`, `sceneParams.getCodeTraits`, `weatherFormatter` labels + `cloudCode`, `icons.tsx` `LEVEL` + ranges | one table keyed by the codes Open-Meteo returns |
| Units (API strings, m/s factors, labels, °C/°F) | `weatherService`, `cloudPhysics.speedToMs`, `sceneParams.toCelsius`, `weatherFormatter`, Navbar buttons | `weather/units.ts` |
| Requested `current` fields | comma string in `weatherService`, `OpenMeteoCurrentData`, formatter destructuring; `ATMOSPHERE_FIELDS` and `PRESSURE_LEVELS` in different files | `CURRENT_FIELDS` const next to the type |
| Override keys | `OVERRIDE_KEYS` (not type-checked), DebugMenu `BoolKey`, two hand lists in `applyOverrides` (`precipPinned`, `skyTouched`) | `satisfies Record<keyof SceneOverrides, …>`; derived key groups |
| Shell keys | `SHELL_KEYS` (a subset check only; a missing key freezes the field silently) | `satisfies Record<keyof ShellTargets, 1>` |
| Quality tiers | `QualityTier`, `QUALITY` keys, `lowerTier` chain, DebugMenu `QUALITY_OPTIONS` | `TIERS` const array, derive the rest |
| Render orders | 10 layer files (−2…30) | `RENDER_ORDER` map in core |
| Tone exposure 0.5 | `WeatherScene.tsx` literal; DiamondDust and cloud radiance tuned against it | `TONE_EXPOSURE` const |
| Palettes | SceneDriver vs SkyGrade `OVERCAST_DAY/NIGHT` (different values); `NIGHT_HAZE` vs `NIGHT_HORIZON`; SceneDriver vs VolumetricClouds `SUN_LOW/HIGH` (different values and ramps); sceneSignals initial colours | SceneDriver publishes the colours; layers read signals |
| Cloud-noise calibration | `COVER_NOISE`/`CIRRUS_NOISE` depend on `cloudNoise.glsl` + the sampling mixes, tied only by a comment | cross-reference comment at the generator; optional dev measuring helper |
| Freezing-level fallback | `shellTargets` `?? 3000`, but CLAUDE.md puts fallbacks in `deriveCloudPhysics` | estimate it in cloudPhysics |
| Fog thresholds | `visibilityM < 1000` ×2, rime 400, `< 800` in shellTargets | named constants |
| Default location | `DEFAULT_LOCATION` (sceneParams) vs `{ q: "katowice" }` (App) | export one |
| Breakpoints 720/440 | 9 media queries | SCSS variables / mixin |
| Blur | `--glass-blur`, `--blur`, literal `blur(6px)`, `liquid-glass(18px)` in loaders | one scale |
| `--accent-warm` | 18 hard-coded OKLCH copies (Loader, MapPicker, MapPicker.tsx pin, HourlyChart stops), plus DebugMenu hex | `oklch(from var(--accent-warm) …)`, an `--accent-warm-hover` token |
| Drawer width | `MapPicker.tsx` consts and the SCSS min/max | keep the TS clamp only |
| Forecast day count 6 | TSX slice, aria-label, SCSS `repeat(6)` | one constant |
| Skip thresholds | TS `coverage < 0.015`, `high < 0.01` vs the shader's | share or document |

## 6. Overengineering

- **The full WMO 0–99 table** (`codes.ts`, `getCodeTraits` "covers the full table"): Open-Meteo returns 28 codes, and labels and icons only cover those.
- **Potato tier fog**: `FogLayer` + `UniformsLib.fog` merge + `s.fogDensity` + the "assign after merge" gotcha, all for one fallback deck that already fades with distance. Fold an exp² fade into the CloudDeck shader and delete FogLayer.
- **MapPicker marker**: `renderToStaticMarkup` (pulls `react-dom/server` into the client) + two memos for a constant icon. A module-level `L.divIcon` with a literal string does the same.
- **Pointless guards**: `reverseGeocode` error wrapping; SSR guards (`typeof navigator/document`) in an SPA; the IE `userLanguage` fallback; `format=json` (already the default); `useCallback` inside `useDeviceOrientation`.
- **Over-wrapped UI state**: `DebugTools { showPerf }` is an object around one boolean; the `formatted` useMemo of 15 trivial strings; double trim/empty checks in Navbar search; MapPicker focus trap via `querySelector` instead of a ref.
- `noiseTexture` (~30 ms CPU) is baked on every mount on every tier, because FrostGlass assigns it even with no frost. Load it lazily.

## 7. Comments

Rule for the cleanup: a comment states a **why** or a non-obvious constraint in one or two lines. No history ("before this…", "used to draw…", "the old version…"), no restating the code, no copies of CLAUDE.md. CLAUDE.md holds the long explanations; code comments point to it when needed.

- **History narration to cut:**
  - `FrameRateGate.tsx:16-28` ("the old rule", watt figures)
  - `worldFrame.ts:36-40` ("now comes from the data")
  - `VolumetricClouds.tsx:125-128` ("was one cell…", added this session)
  - `volumetricClouds.glsl.ts:226-227,435-437` ("drew white outlines")
  - `Thunder.tsx:76-81` ("ONE time base")
  - `MapPicker.scss:342-343,357-359`
  - `weatherFormatter.ts:46-53` (dated 11:15 anecdote, added this session; it also wrongly says the scene uses the code)
  - `SceneDriver.tsx` / `cloudPhysics.ts` notes that say "a tropical afternoon drew…"
- **Essays duplicating CLAUDE.md:**
  - `cloudPhysics.ts:1-22` header (also stale: it leaves out the shallow cap and the τ blending)
  - `volumetricClouds.glsl.ts:134-138,147-149,154-159`
  - `VolumetricClouds.tsx:186-194`
  - `useIsMobile.ts:3-11`
  - `_glass.scss:1-19`, `index.scss:47-50`
  - `getFrostAmount` doc; `SkyGrade.tsx:12` vs the shader header
- **Stale or wrong:**
  - `sceneSignals.tsx:48` flash range "0..~1.5" (it peaks ~0.8)
  - `weatherService.ts:59` "fall back to coordinates" (it falls back to the timezone city)
  - `types.ts:68` "mm or in" (always mm)
  - `glsl:50` `uType` list leaves out 0.3 altocumulus
  - `cloudPhysics.ts:172` "(type ≈ 0.74)" refers to a shader value
  - CLAUDE.md: "named exports except …" (Navbar, CurrentWeather, HourlyChart and WeeklyForecast default-export too); "key handlers ignore inputs" (F7 doesn't); "formatter's dt/sunrise … the scene doesn't use them" (the UI does, see P0)
- **Restating code:** `CurrentWeather.tsx:85` `// Night phase`, `MapPicker.tsx:43`.
- **Missing why:**
  - `App.tsx:29` `MIN_LOADING_MS`
  - `HourlyChart.tsx:32-33,94`
  - `Thunder.tsx:108` (mobile flash 0.7)
  - `SceneDriver.tsx:92` (the 5° in `kAlt`)
  - `viewVolume.ts:40` (2° margin)
  - `cloudPhysics.ts:202` (CAPE override semantics)
  - `SHELL_KEYS` (must list every field)
  - `Precipitation.tsx:153` (hail uses the snow volume)
  - `cloudNoise.glsl.ts:1` (changing it invalidates the calibration)

## 8. Code organisation

```
src/
  App.tsx                 277  state + fetch effect + debug key/tap handling + layout + 2 formatters
  services/               API calls, geocoder, errors, weatherFormatter (mapping + labels + display formatting)
  weather/                domain: types, codes, sceneParams (types + mapping + overrides + frost + sun), cloudPhysics, presets
  components/             UI + icons.tsx; components/weather-scene/WeatherSceneContainer.tsx (scene glue)
  styles/                 _glass.scss + useGlassSpotlight.ts (a hook)
  weather-scene/          core/ layers/ shaders/ debug/
```

The top-level split (services → domain → scene, UI apart) is sound and matches the one data path in CLAUDE.md. The problems are inside files, plus a few misplaced pieces:

| Issue | Where | Proposal |
|---|---|---|
| One file, three jobs | `services/weatherFormatter.ts` | `services/openMeteoMapper.ts` (API → `WeatherData`), `weather/codes.ts` (labels, `cloudCode`), `utils/format.ts` (degrees, speed, coords, time, cardinal, GMT offset) |
| WMO knowledge in 4 files | codes / sceneParams / formatter / icons | `weather/codes.ts` holds one table: `{ label, intensity, liquid, frozen, drizzle, freezing, showers, hail, grains, fog, rime, thunder, cover }`. `getCodeTraits`, the labels and the icon marks read it |
| `App.tsx` owns fetching and debug input | `App.tsx` | `hooks/useWeather(query, units)` (fetch, cancel, min loading, error mapping, periodic refetch) and `hooks/useDebugToggle()` (F7 + 5 taps). App keeps state wiring and layout |
| `sceneParams.ts` (573 lines) mixes concerns | `weather/sceneParams.ts` | split `weather/overrides.ts` (`SceneOverrides`, `OVERRIDE_KEYS`, `applyOverrides`, `isOverridesDirty`, `resolveTime`) and `weather/frost.ts` (`getFrostAmount`); inline `getSunAltitude` into DebugMenu |
| Renderer + generator + domain mapping in one file | `layers/VolumetricClouds.tsx` (470) | `weather-scene/clouds/` → `VolumetricClouds.tsx`, `cloudNoise3D.ts` (generator + cache), `shellTargets.ts` (weather → shell, pure, testable), `shaders/` (march / resolve / composite) |
| GLSL helpers copy-pasted | shaders | `shaders/chunks.glsl.ts`: `noiseRank`, `remap`, FBM weights, `cirrusAlpha`, `VIEW_RAY`, `BLOCK_OFFSET` |
| Scene constants scattered | 10+ files | `weather-scene/core/constants.ts`: `RENDER_ORDER`, `TONE_EXPOSURE`, `MAX_DT`, `TIERS` (`worldFrame.ts` keeps geometry) |
| Scene glue in the UI tree | `components/weather-scene/WeatherSceneContainer.tsx` | move to `weather-scene/WeatherSceneContainer.tsx` (with the error boundary); `components/` is then pure UI |
| A hook in `styles/` | `styles/useGlassSpotlight.ts` | `hooks/useGlassSpotlight.ts` (keep the SCSS mixin in `styles/`) |
| Icon set incomplete | inline SVGs in CurrentWeather/Navbar/MapPicker/DebugMenu | `icons.tsx` gets `LineIcon` (shared svg attributes), `CloseIcon`, `SunIcon`; CurrentWeather renders its stats from a data array |
| SCSS shared values | per-file literals | `styles/_tokens.scss` (breakpoints, blur scale, z-index) + `styles/_mixins.scss` (`label`, `phone`) |
| Precipitation specs as code | `precip/Precipitation.tsx` | static `KINDS` table + a thin `buildSpecs` for intensity-driven values |

Don't move: `weather-scene/core/*` (cohesive), `layers/*` (one file per layer works), `services/geocoder.ts`, `components/*/` folders.

## 9. Refactor plan

Each phase is one or a few commits, behaviour-preserving unless marked, and verified with `npm run build` plus the headless screenshot harness used in this session (Ponte de Sor 10:45 and fair-weather cumulus at 50 %; worth committing as `scripts/shot.mjs`, dev-only).

**Phase 0 — bug fixes (behaviour changes, small, highest value)** — ✅ done 2026-10-13
1. Timezone-aware ISO parsing (`{ zone }` / `timeformat=unixtime`); fix the CLAUDE.md note.
2. Cloud drift in noise space (fixes the featureScale slide); wrap the frame counter.
3. MapPicker: memoised `initialCenter`, focus logic on open transitions only, `inert` when closed.
4. `formatDegrees` with the −0 fix.
5. PerformanceMonitor ignores declines while pinned; `transparent` on the bolt core.
6. Open-Meteo error `reason`; geocoder 5xx → `API_ERROR`; `hasSplit` `!= null`.
7. Rain bump only for pinned thunder/hail; CAPE pin keeps the convection floors; the shallow cap ignores cirrus levels.
8. Periodic refetch (15–30 min) so the hourly chart and current data never go stale.

**Phase 1 — dead code and config (no behaviour change)** — ✅ done 2026-10-13. Deviations: `forecast_hours: 14` (12 points + slack until the 15-min refresh); constant uniforms kept (GLSL consts would duplicate JS constants or need linear-colour literals); `.tools` and `.sun-end` kept (grid items in the mobile layouts); `getSunAltitude` inlined into DebugMenu.
- Data:
  - Drop the hourly fields nobody reads (`precipitation_probability`, `weather_code`); `forecast_hours: 13`.
  - Drop the unused API, geocoder and physics fields.
  - Hard-code the `forecast` endpoint.
  - Drop `NETWORK_ERROR` and the `reverseGeocode` error wrapping.
  - Collapse `FOG_MAX_VISIBILITY_M` to one value.
- Scene:
  - `SceneSignals.facing` becomes a local; plain initial values in `createSceneSignals`.
  - Make the `FrameRateGate` prop required.
  - Constant uniforms become GLSL consts.
  - Remove the eslint comment.
- UI:
  - Remove the `logo192` link, `browserslist` and the second Toastify CSS import.
  - Make the Navbar props required.
  - Remove the `useId` sanitisers and the unused `strokeWidth` prop.
  - Flatten the single-child wrappers.
  - Use a module-level Leaflet `divIcon` and drop `react-dom/server`.
- Un-export the local-only types.

**Phase 2 — single sources of truth** — ✅ done 2026-10-13. Deviations: palettes centralised in `core/palette.ts` but their values kept (the look-alike pairs are tuned on purpose — sky veil vs horizon haze, cloud-base red vs sun disc); the three sun drawings stay (filled logo, UV stat, weather icon differ by design); the loader keeps its 18 px blur; `smoothstep` already had MathUtils' argument order (the trap is GLSL's order — documented in `utils/math.ts`); display formatting went straight to `utils/format.ts`, so phase 3's formatter split is half done.
- **Domain:**
  - `weather/codes.ts` becomes the single WMO table (fixes the 56/77 intensities).
  - `weather/units.ts`.
  - `CURRENT_FIELDS` next to `OpenMeteoCurrentData`.
  - `OVERRIDE_KEYS` and `SHELL_KEYS` checked with `satisfies` against their types; key groups derived.
  - The freezing-level fallback moves into cloudPhysics.
  - Named fog constants.
  - `deckCover()` helper.
  - `utils/math.ts`: `clamp`, `clamp01`, `smoothstep` with one argument order (or `MathUtils` everywhere).
- **Scene:**
  - `core/constants.ts`: `RENDER_ORDER`, `TONE_EXPOSURE`, `MAX_DT`, `TIERS`.
  - SceneDriver publishes the overcast, night-horizon and sun colours; SkyGrade and the clouds read them.
  - `shaders/chunks.glsl.ts`.
- **UI:**
  - `utils/format.ts`: degrees, coords, time, GMT offset.
  - `icons.tsx`: `LineIcon`, `CloseIcon`, `SunIcon`.
  - SCSS `_tokens.scss` / `_mixins.scss`: breakpoints, blur scale, `label` mixin, accent derivations. DebugMenu.scss moves onto the tokens.
  - One constant for the forecast day count.

**Phase 3 — file reorganisation (moves and splits, no behaviour change)** — ✅ done 2026-10-13. Deviations: the volumetric clouds went to `layers/clouds/` (like `layers/precip/`) and their shaders stay in `shaders/` with every other layer's; the noise cache is now keyed by renderer (P2 fix, free during the move); every component moved to named exports (only `App` default-exports); README rewritten (it still described the CRA-era engine).
- Split `weatherFormatter.ts` into `services/openMeteoMapper.ts` + `weather/codes.ts` + `utils/format.ts`.
- Split `sceneParams.ts` into `sceneParams.ts` + `overrides.ts` + `frost.ts`.
- `App.tsx` → `hooks/useWeather.ts` + `hooks/useDebugToggle.ts`; `useGlassSpotlight` moves to `hooks/`.
- `weather-scene/clouds/` (`VolumetricClouds.tsx`, `cloudNoise3D.ts`, `shellTargets.ts`, shaders); `WeatherSceneContainer` moves to `weather-scene/`.
- Precipitation `KINDS` table; rebuild only on kind change, with live emitter updates.
- Update the CLAUDE.md directory map in the same commit.

**Phase 4 — comments pass** — ✅ done 2026-10-13 (35 files, +107/−222 lines, every file proven comment-only by an AST/compiled-CSS comparison against HEAD). Fixed wrong comments on the way: `PrecipState` WMO ranges (showers 80–86, hail 96/99), precipitation always in mm, flash range 0..~0.8, precipitation fall speeds are scene units/s (not m/s), `useWeather` drops (doesn't abort) a superseded fetch, `uType` lists altocumulus. Whys still unknown, left without a comment: the mobile flash factor 0.7 (Thunder), hail on the snow spawn volume (Precipitation), the 2° margin (viewVolume). Still to verify: whether `current.rain/showers/snowfall` are 15-min sums (P2).
- Apply §7 file by file: cut history and essays, fix the stale and wrong comments, add the missing whys.
- Shorten the file headers to 1–3 lines and point to CLAUDE.md for the long form.
- Fix the stale CLAUDE.md lines.

**Phase 5 — simplifications with visual risk (screenshot before/after)**
- Fold the potato-tier fog into the CloudDeck shader; delete `FogLayer` and `s.fogDensity`.
- Thunder: persistent line geometry updated in place, no React state per strike.
- Clouds: sun/moon light crossfade, moon lit from its real altitude, noise cache keyed by renderer, base floor, history invalidation in `useFrame`, particle renderer disposal.
- Lazy frost noise; seeded star field; light-step cap tied to the budget.
- Re-evaluate whether the potato tier pays for itself (CloudDeck + shader + noise texture ≈ 350 lines) against `low` at a smaller cloud scale.

## 10. Checked and fine

- `tsc --noUnusedLocals --noUnusedParameters`: no unused imports, locals or parameters.
- Every export is referenced elsewhere (13 types only locally, see §3).
- Every npm dependency is imported (`quarks.core` is pinned deliberately).
- Volumetric uniforms: none dead in either direction; every `ShellTargets` field is used; every GLSL helper is called.
- No allocations inside any `useFrame`; useMemo'd materials, geometries and textures are disposed (except the particle renderer, P2).
- Camera constants: one source (`worldFrame.ts`) shared by `<Canvas>`, CameraRig and viewVolume.
- All SCSS classes, keyframes, mixins and the `$glass-reveal` variable are used.
- Divisions in the cloud code are guarded (`uFeatureScale` ≥ 0.2, thickness ≥ 80, haze ≥ 1200).
