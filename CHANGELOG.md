# Changelog

Notable changes, newest first. Dates are commit dates; history before 2026-10 is condensed from `git log`.

## Unreleased

### Changed (scene)
- Twilight: a deep blue sky over a warm horizon glow through the blue hour, instead of a dull grey with a pale band at the bottom.
- The moon no longer spends the middle of the night behind the cards (it crosses the content column in minutes, not hours), stays on the far side from the sun through the whole twilight, and fades out when low over the horizon by day.
- Overcast at dusk: the horizon and the sky veil under the red-lit deck turn dark and warm instead of a pale grey band; the sun's disc no longer shows through the ground haze after sunset.
- Lens flare for the sun (and a bright moon at night): aperture ghosts along the axis through the frame's centre, a faint rainbow ring and diffraction spikes; clouds over the source put it out.
- Sun and moon no longer huddle in one gutter: with both up on the same side, the moon nearer the middle moves to the other side — the evening's waxing crescent rises on the left while the sun sets on the right, and glides back after sunset.
- Rain and hail spawn further from the camera: no more single drops slashing across the frame or blurred hailstones in front of the lens.
- The sun glows: a rim and halo of light round the disc (`SunGlow`), full by a low sun, gentle high up so the disc keeps its edge; off under overcast and fog.
- A low deck under a mid sky gets a thin mid layer (altocumulus/altostratus sheet) above it — both layers show instead of the mid cover folded into the low deck.
- No more floating cotton balls: the fine part of the cover noise only shapes the rims of cells, isolated islands of it are gone.
- Tall towers: the light march covers a near cone plus one long step, jittered — no terraces or stripes along lit flanks.
- Overcast and rain decks are mottled from below: the diffuse light under a closing deck follows the local column thickness (its lumpy-base factor), so thinner patches are brighter — it was one flat grey once nearby clouds rendered at all.
- God rays read: clouds now cut shadow lanes into the bright air round the sun (the composite dims the sky behind them through its alpha), the clear share of each ray is contrast-raised, only thick cloud occludes (cirrus no longer greys the whole sky), and a 4-tap tent hides the jitter. A clear sky keeps the glare round the sun (the whole pass used to be skipped with no clouds).
- Sun disc 0.95° → 1.4° radius.
- Clouds: sun and moon light crossfade at dusk instead of switching (a ~6× jump), and the moon lights them from its real altitude (no more rim-lit outlines under a bright moon); the shell base has a 30 m floor.
- Potato tier: the deck draws its own exp² fog (identical look); `FogLayer` and the fog-density signal are gone.
- Lightning reuses one line geometry instead of rebuilding a drei `<Line>` (and its shader) per strike.
- Precipitation: a fresh particle renderer per rebuild, the old one fully disposed (emptied batches piled up before).
- The 2D noise texture is baked only when frost or the potato deck first shows; the star field no longer reshuffles on resize.

### Fixed
- **Cloud cover vs the label.** No cloud layer is drawn above the measured total cover any more, so a "Mainly clear 26 %" sky no longer draws a nearly closed grey deck.
  - **Cause.** In Scandinavia and the Baltics Open-Meteo's `best_match` is MET Nordic. Its total cover is corrected; its layers are raw, and they can contradict the total (Jēkabpils 14:00: total 18 %, low 100 %, 925 hPa 27 %; ECMWF and ICON had no such contradiction). No overlap lets one layer cover more than all of them together, so the scene now trusts the total, which the label and icon already show.
  - **Measured on 4,032 real place-hours** (42 places, 3 days, run through the real mapper and cloud physics):
    - layers above the total: 0.7 % of hours, nearly all in Oslo, Jēkabpils and Helsinki;
    - closed decks under a total below 50 %: 12 → 0;
    - decks more than 0.2 above the total: 30 → 1 (Reykjavik drizzle, held at the 0.25 drizzle floor on purpose);
    - 96 hours changed in all (2.4 %). Outside the Nordics only by 0.01–0.06, where a layer sat a point or two above the total.
  - **Rejected:** capping the low cover by the pressure levels. It would cut 20 % of consistent decks by more than 0.3, because thin decks fall between the levels (overcast at 100 % with the levels below 2.5 km at 16–70 %).
  - **Not compensated:** a broken deck still looks fuller than its percentage towards the horizon, as a real one does: slant lines of sight cross several cells.
  - Checked on screen with live Jēkabpils data and with the screenshot-time values pinned.
- **Debug menu keyboard handling.** It now closes on Escape, moves focus to its close button, keeps Tab inside, and gives focus back on close, like the map drawer. Its dialog role sits on the panel, not the backdrop.
  - With both the menu and the drawer open, Escape closes only the top one. Before, it closed the drawer underneath.
  - The drawer's Escape listener is registered only while it is open.
- **Debug pins.** Two changes in the same tick both land; the second used to overwrite the first.
- Clouds on a page left open for days: the wind drifts grew without bound and went to the GPU as float32 — within about a day the 520 m detail noise moved in visible steps, and the mid layer and cirrus followed after a few days. The drifts stay in JS doubles and are handed over wrapped by the common tile period of every noise lookup that reads them: low cover and shape 2000 km, detail 520 m, mid layer 400 km, the potato deck's low cover 10 tiles. The cirrus, read in the rotated wind frame, gets fractions of its own tiles. The tile sizes are exported from the GLSL modules and checked against the periods in dev. It draws the same: 100 000 drifts up to 1e9 m land on the same noise coordinate to within 1e-10 of a tile.
- Moon lens flare: night and overcast were counted twice (once in the clouds' moonlight `moonIntensity`, once in the flare), so its fade through twilight was squared. Night, altitude, phase and clouds/haze now count once each. A clear full moon is exactly as bright as before (`MOON_GAIN` 0.05 → 0.0225); twilight and thin cloud no longer kill the flare early.
- Cloud aerial haze uses the same visibility as the sky's haze (heat shimmer included); at 30 °C+ distant clouds sank into a clearer haze than the horizon behind them.
- Debug: pinning drizzle, freezing, hail, grains or rime now drops the measured sky (radiation-derived τ, pressure-level evidence for a mid deck) as rain/snow/thunder/showers pins did — each changes the rate or the fog, which the real sky doesn't describe. The preset highlight follows the overrides: editing any weather field after picking a preset unhighlights it (it stayed lit).
- Map picker: with no weather loaded it centres on the default location (Katowice) instead of its own Warsaw fallback. The drawer's cursor glow fades in and out (its own transform transition dropped the glow's).
- Clouds within a few km vanished on Windows (Chrome → ANGLE → D3D11): the raymarch sampled its noise with implicit derivatives inside data-dependent loops, and every ray that turned opaque came back empty — skies showed "clouds only at the horizon". Noise lookups are explicit-LOD now (identical values, the noise has no mips).
- iOS: an orientation permission granted after the scene unmounted no longer leaves a listener behind.
- Scene errors are logged; asset paths respect the deploy base; the °C/°F buttons expose `aria-pressed`.
- Sunrise/sunset, hourly labels and forecast day names were shifted by the difference between the browser's and the location's time zone.
- Clouds slid sideways whenever the low-deck noise scale changed, worse the longer the page was open; the frame counter no longer grows without bound (banding after hours, unmarched pixels after ~77 h).
- Map picker: the picked point and focus no longer reset on every app re-render; the closed drawer is out of the tab order.
- "-0°" for temperatures just below zero.
- A pinned quality tier no longer lowers the automatic one; the lightning bolt core is no longer greyed by the sky.
- Open-Meteo error reasons are kept (logged); a failing geocoder reports a service error, not "City not found"; measured precipitation with null rain/showers/snowfall is no longer dropped.
- Debug: pinning e.g. the hour no longer adds rain to measured thunder or hail; a pinned CAPE keeps the shower/storm convection floor; cirrus no longer lifts the fair-weather cumulus cap to ~9 km.
- Weather refreshes silently every 15 minutes, so current conditions and the hourly chart don't go stale.

### Changed (weather → clouds)
- The drawn deck goes to the mid level also when a low cover outweighed by mid isn't backed by any pressure level below 2.5 km (sub-grid low cloud under a mid sky), decided in `cloudPhysics` (`midDeck`, shown in the debug readout); `trustRadiation` → `measuredSky`.
- Checked the τ → extinction calibration against the shader's own density (`SHELL_FILL` 0.35 holds: 0.31–0.38 per unit cover).

### Changed (tooling)
- npm → **pnpm 12** (`packageManager`, `pnpm-lock.yaml`, settings in `pnpm-workspace.yaml`); `.npmrc` (`legacy-peer-deps`) and `package-lock.json` removed. `quarks.core` is an override instead of a direct dependency.
- Dependencies updated to the latest releases and pinned exact: React 19.3, three 0.186, R3F 9.8, drei 10.7.9, Vite 8 (Rolldown) + plugin-react 6, TypeScript 7, sass-embedded 1.105, @vercel/analytics 2, suncalc 2; `@types/node` follows the Node 24 runtime; `@types/suncalc` dropped (suncalc 2 ships its own types).
- suncalc 2 returns degrees, azimuth clockwise from north and refraction-corrected altitude: converted to the scene's radians-from-south in `SceneDriver` (`azimuthFromCompassDeg`); positions agree with v1 within ~0.7°.

### Changed (comments)
- **Sky, cloud and physics comments.** The comments added with the sun-in-view, god-ray, mid-layer and lens-flare work are cut to the why. The incident stories are gone:
  - "a grey band at the horizon", "a pale lavender band", "a pair of lamps", "a white blob the size of a fist";
  - "every overcast base went black", "a dot pattern once the lanes got contrast";
  - the Sesvete and autumn-τ anecdotes.

  Each keeps the reason it was protecting against, in one line; the long form is in this changelog. The ANGLE note in the cloud noise is a pointer to the CLAUDE.md gotcha.

  12 files: sky light, celestial, sky layer and grade, sun glow, cloud density, lighting, rays, composite and lighting model, precipitation kinds, cloud physics. Each was proven comment-only: with comments and whitespace stripped, every file is identical to the previous commit.
- Comments cut to the why: no history narration or essays duplicating CLAUDE.md, short file headers; wrong ones fixed (WMO ranges in `PrecipState`, precipitation units, flash range, fall-speed units, `uType` list, fetch cancellation wording).

### Changed (places, disc fades, leftovers)
- **Geocoding once per place.** Resolved places are cached per query (a city name → its coordinates and name, a picked point → its reverse-geocoded name), so the 15-min silent refresh and a °C/°F switch go straight to the forecast. Only named places are kept, so a failed reverse lookup is retried.
  - Measured: the search (120–330 ms) or the Nominatim lookup (120–430 ms) ran before the forecast (~210 ms) every time, in series, on every refresh and toggle.
  - In Chrome a toggle sent search + forecast before and sends only the forecast now. It also eases the load on Nominatim, whose usage policy asks for light use.
- **One disc-visibility ramp per body.** `signals.sunDisc` (−1° → 0.5°) and `signals.moonDisc` (−1° → 2°), written in `skyLight`. The sky's sun disc, `SunGlow` and the sun's flare follow the first; the moon and its flare the second.
  - Measured at the horizon (0°): the disc was 74 % visible, its glow 35 % and its flare 26 %; the moon's flare was 0 % with its disc at 26 %.
  - Visible change: the glow and flare reach full strength together with the disc in the last ~1.5° before sunset, and fade with it after. Checked on screen at a pinned 0.5° sunset.
  - God rays and the clouds' moonlight keep their own ramps: they are light through the air mass, not the disc.
- `DISPLAY_OVERLAY` (`core/constants.ts`): the flags of a light added in display space (additive, no depth, never tone-mapped), used by `SunGlow` and `LensFlare`, which had the same five lines.
- **Not done:** a `useDisposable` hook. Each of the 12 disposals is already one effect line next to its `useMemo`, so the hook would save about a line per site and add one more pattern.
- **Leftovers.**
  - Five exports nobody imported (`SetOverride`, `rayStrength`, `RayPasses`, `KindDef`, `SystemSpec`) are file-local. An audit script over every export in `src/` now finds none.
  - `describeScreenDrift`, a debug-readout string, moved from the scene core (`core/worldFrame.ts`) to the debug menu's helpers; `Facing` is exported for it.
  - The dev-only drift-period checks in `cloudDrift.ts` stay. They tie the TS wrap periods to the GLSL tile sizes; without them a noise change would silently break the wrap.

### Changed (docs)
- **CLAUDE.md as rules.** CLAUDE.md holds the rules and gotchas only (43.5 → 33 KB). Gone from it:
  - how each value was tuned and what it drew before ("a 900 m slab that closed the frame", "autumn mornings read as τ 100–250", "before this, 20 % cover drew nothing");
  - the long sun-in-view, god-ray and cloud-physics paragraphs, rewritten as rule lists with the constants they name.

  The history stays here. The directory map follows the module split (celestial, sky light, cloud passes, lighting, drift, precipitation kinds, debug-menu and hero parts, the dialog and clock hooks). New conventions: pure logic out of frame loops, derived per-frame values published once in `SceneSignals`, shader constants interpolated from one TS export, comments without history.
- The weather catalogue is the presets: each preset in `scenePresets.ts` carries a note of what the scene should show, shown as the button's tooltip in the debug menu. `SCENE_REFACTOR.md` (the finished scene-rewrite plan) is removed.
- `REVIEW.md` (the 2026-10-13 code review) is removed: its findings were worked through in the entries recorded here.

### Changed (file organisation)
- **UI components split.**
  - **Checks:** the rendered DOM was compared before and after in Chrome, normalised (digits, generated ids): identical for the hero, navbar, chart, forecast and map drawer. The debug menu differs only in its dialog role. The compiled CSS moved declaration-identical. Keyboard behaviour was tested in Chrome.
  - **`DebugMenu.tsx` (371 → 105 lines):**
    - `helpers.ts`: formatting and a `DebugContext` carrying the pins, the setter and the current/effective params. The fields no longer take `overrides={o} onSet={set}`, which was passed 23 times.
    - `fields.tsx`: `OptionButton` replaces seven copies of the active-class pattern; plus `NumericField`, `FlagChip` and `PerfReadout`.
    - `sections.tsx`: presets, time, clouds, wind, precipitation, atmosphere, tools.
  - **`CurrentWeather.tsx` (295 → 58 lines):**
    - `HeroStats.tsx`: the eight tiles from one data array instead of eight hand-written blocks;
    - `SunArc.tsx`: the arc, with its day/night window as a pure function;
    - `hooks/useLiveClock.ts`: the ticking location time.
  - **`MapPicker.tsx` (288 → 199 lines):** `useDrawerResize` and `useSlowTileLoading` (`map-picker/hooks.ts`), and the shared `hooks/useDialogFocus`. The `useCallback`s that bought nothing are gone.
  - **Navbar:** the search handler is merged into the submit, and the °C/°F buttons are one map.
  - **Global sheet:** the refetch pill's size is a `loader-pill--lg` modifier (`large` prop) instead of a global override. The perf-stats panels' rules moved to the debug sheet.
- **Weather domain and precipitation (no behaviour change).** Checked bit-identical on 20 000 random weathers and override sets: every SceneParams and shell field. Rain, sleet and hail were checked in Chrome.
  - **`deriveCloudPhysics`:** was one 152-line function. Now it composes named pure steps, each with its own inputs and outputs: `estimateConvection`, `estimateBase`, `estimateTop`, `layerHeights` (mid/cirrus heights, where the drawn deck sits), `estimateOpticalDepth` and `windsAloft`.
  - **`applyOverrides`:** was 120 lines. It hands the precipitation pins (`precipFromOverrides`, including the "pinned on with no rate" defaults) and the cloud pins (`cloudsFromOverrides`, including the deck that pinned precipitation brings) to their own functions.
  - **Precipitation:** the per-kind table (`KINDS`), the weather → system specs mapping and the mean-life estimate moved to `layers/precip/kinds.ts`. `Precipitation.tsx` (284 → 153 lines) keeps the quarks lifecycle and the per-frame updates.
- Pure scene logic out of the frame loops (no visible change). The volumetric cloud shaders (one 624-line module) split into `shaders/clouds/`: `march` (uniforms, adaptive march, entry point) with the `density` (shell geometry, calibrated cover field, density), `lighting` (phase, light march, scattering octaves, two-stream floor) and `layers` (mid sheet and cirrus, now functions composited by the march) chunks, plus `resolve`, `rays`, `composite` and `common`; the interleaved gradient noise is one shared chunk (`IGN`, was defined twice). `VolumetricClouds` (481 → 197 lines) keeps state, easing and the per-frame wiring; its lighting model is a pure `cloudLighting()` writing the march's uniforms in place, the materials and targets come from `cloudPasses`, the god rays (strength + pass) from `godRays`. `SceneDriver` (262 → 96 lines) keeps suncalc, gusts and winds aloft; the sun/moon display directions (squeeze, gutters, pairing) are `core/celestial.ts`, the day/night factors, overcast, haze, horizon and light colours `core/skyLight.ts`. Lens flare and god rays share one `projectToScreen` (the projection was copied in both). Checked bit-identical: 760 000 old/new comparisons on random inputs; the resolve, rays and composite shaders are textually identical, the march differs only by the mid/cirrus blocks becoming functions.
- `services/weatherFormatter.ts` → `services/openMeteoMapper.ts` (API → app data only); `fetchWeather` is a named export.
- `App.tsx` keeps state and layout; fetching, refresh and error text live in `hooks/useWeather`, the F7 / 5-tap toggle in `hooks/useDebugToggle`; `useGlassSpotlight` moved to `hooks/`.
- `weather/sceneParams.ts` split into `sceneParams.ts`, `overrides.ts` and `frost.ts`.
- Volumetric clouds split into `layers/clouds/` (renderer, `shellTargets`, `cloudNoise3D`, `fullscreenPass`); `WeatherSceneContainer` moved into `weather-scene/`.
- Precipitation: one static table per kind; a system is rebuilt only when the set of kinds changes, rate/fall speed/colour/sway update live (a rate change no longer pops the particles).
- The cloud noise cache is keyed by renderer, so a remount with a new WebGL context regenerates it instead of reusing a dead texture.
- Named exports everywhere except `App`; README brought up to date.

### Changed (logic in its own layer)
- **Altocumulus depth (visible).** A deck drawn in the mid band now has its optical depth from the drawn deck: the mid band −350…+450 m (`CloudPhysics.deckBaseM` / `deckTopM`). Before, it came from the unrelated low (LCL) slab under it.
  - The shell used to invent the mid deck's geometry itself. Now it reads it from the physics.
  - The Altocumulus preset goes from τ 6.4 (a 400 m LCL slab) to 12.8: firmer cells, same height.
  - Mid decks over a thick rain slab are no longer τ 50+.
  - Checked over 20 000 random weathers: τ changed in 1 935 mid-deck cases, in no other.
  - The debug readout shows the drawn deck's range next to the LCL.
- **Storm gloom and haze distance** are shell targets: they ease with the weather like the rest of the shell. Before, they were computed in the lighting every frame and jumped when rain or visibility changed.
- **Only the primary shell fields ease.** Density and noise feature scale are re-derived from them (`withDerived`), so they no longer drift off their own formula mid-transition.
- **The cloud shader's lumpy-base factor** is an `out` parameter of `density()` instead of a global that had to be read right after the lit sample's call (textually checked, same draw).
- **Moved to their layers:**
  - **Weather domain:** the diamond-dust rule (`weather/frost.ts`).
  - **Scene core:**
    - the quality tiers (`core/quality.ts`);
    - the default parallax (`core/worldFrame.ts`);
    - the sun disc size (`core/constants.ts`, imported by both the sky and the glow).
  - **Potato-deck file:** the deck's height and fog helper (`CloudDeck.tsx`) and its fade distance (`cloudDeck.glsl.ts`).
  - **UI:** the load source (`Navbar.tsx`).
- **`SceneParams` describes only the weather:** the quality tier and parallax are scene props, resolved from the debug pins in App (`pinned()`).

### Changed (single sources of truth)
- **UI.** Checked with a declaration-by-declaration diff of the compiled CSS and in Chrome.
  - **Transitions:** one `$glass-glow-transition` for the ten transition lists that must carry the reveal glow, and one `$ease-out` for the entrance and drawer curves. The CSS compiles identically.
  - **Tokens:**
    - `--danger` for the error box and `--panel` for the map drawer and its popups, tinted with `color-mix` like the accent;
    - a `$z-*` stacking scale (refresh pill, map drawer, debug menu, perf stats). The drawer's 8001 inside its own 8000 stacking context is a plain 1.
    - The debug panel's own greys (white 10–50 %, `#e0e0e0`, `#0f0f1a`) moved onto the app's fill/stroke/fg tokens, so it now looks like the app. Its active option is accent-tinted (it looked the same as hover). This is the one visible change.
  - **Mono labels:** `mono-label` takes `$upper` and replaces nine hand-written copies of the recipe: footer, section hint, chart hours, forecast dates, map popups and attribution, the key labels of the hero, sunrise/sunset, forecast and map. Sizes are unchanged.
  - **Display formatting through `utils/format.ts`:**
    - the UV index (`formatUv`, written twice);
    - the hero clock and the debug time (`formatToLocalTime` instead of calling luxon directly).
  - **TS ↔ SCSS duplicates:**
    - the hourly chart's gradient id comes from `useId`, with its fill set on the path (an id written in both the TSX and the SCSS would clash with a second chart);
    - "Next N hours" follows `POINTS`;
    - the map pin's ink colour is named once;
    - the cursor-reveal reach is the CSS variable `--glass-reveal`, read by `useGlassSpotlight` instead of copied as 160.
- **Scene.** Every output was checked old vs new on 20 000 random skies, cameras and weathers: bit-identical except the rain/snow ambient below and float rounding (≤ 1e-15). The shaders were compared as normalised text.
  - **SceneDriver publishes once per frame what layers re-derived:**
    - the real altitudes in degrees (`sunAltDeg` / `moonAltDeg`; converted in 10 places);
    - the display-space sun colour (`sunColorDisplay`; encoded separately by the sun glow, the lens flare and the god rays);
    - the clouds' light directions (`sunLightDir` / `moonLightDir`, display azimuth at the real altitude). VolumetricClouds recovered them from the display direction through `atan2`.
  - **One sky-closure ramp.** The sky's `overcast` and `cloudFill` share one `deckRamp` over `skyClosure`. The clouds' daylight adaptation uses `deckClosing` and `TWO_STREAM_K` from cloudPhysics (0.1125 was written in three places).
  - **Every scene colour comes from `palette.ts`:**
    - the deck's lit/shade/storm tones, the town glow under night clouds, lightning inside clouds and in the sky, the ground band, stars, the moon disc and its flare tint, the bolt's glow and core, frost, diamond dust;
    - GLSL takes them through `glslColor()`, at float32 precision (`glslFloat()`);
    - the lens-flare ghost tints stay in their shader, as part of the effect.
  - **Shared GLSL:**
    - `coverMask` / `closeGaps` (the shell and the mid layer wrote the cover mask twice);
    - `aerial()` (the aerial-perspective fade, three times);
    - one `BILLBOARD_VERT`, `CELESTIAL_DISTANCE` and `placeBillboard` for the sun glow and the moon (identical shaders and placement);
    - the layer threshold (`LAYER_MIN`) and the cover fade-in (`COVER_FADE_IN`) shared between the shader and the clear-sky skip.
  - **Storm darkness (visible).** One `stormDim()` drives the potato deck's storm tint and the volumetric clouds' ambient (× 0.5).
    - Before, the volumetric path used its own step: 0.3 above 4 mm/h, 0.5 under thunder, nothing for snow.
    - Now moderate rain darkens a little (2.5 mm/h → 0.1), the 4 mm/h jump is gone, heavy rain and heavy snow reach 0.3, and storms are unchanged.
  - **Calibration notes.** The noise generator's re-measure note now lists `COVER_NOISE_LOW`. The deck's stats are marked as measured over the 2D texture.
- Weather domain (no visible change; checked on 20 000 random weathers and override sets, every SceneParams field identical apart from one edge below):
  - The cloud-physics input is built in one place, `physicsFor(scene, measuredSky, override)`. It was written out by hand three times: the default scene, the measured weather and the debug overrides. Their fog flags read differently but always agreed, since a fog code caps visibility under 1 km. The default scene no longer writes its temperature and dew point twice.
  - Precipitation lives in `weather/precip.ts`: the state, the gauge/code mapping with its fallback rates, and one `finalizePrecip()` that keeps each flag only where something falls (drizzle and glaze need rain, grains need snow). The measured path used to keep the grains flag of code 77 when the hourly split reported no snow; the debug path already dropped it.
  - The WMO table is read directly (`codeInfo` + `fallsLiquid`) instead of being copied into a parallel set of booleans.
  - Visibility thresholds in `weather/fog.ts`: fog under 1 km, the 700 m cap under fog codes, the 400 m rime cap, the 24 km default. They were spread over three files.
  - `cloudPhysics` names its numbers: band and clear-level cover, the τ per km of rain cloud, the τ ceiling. It names its two cover measures too: `deckCover` (the drawn shell, mid weighted 0.85) and `skyClosure` (unweighted, what dims the sun). `deckClosing` is the one 80 → 100 % ramp. `TWO_STREAM_K` is derived from the droplet asymmetry instead of copied as 0.1125.
  - Weather data always carries its coordinates, so the guards against missing lat/lon are gone.
- One WMO table (`weather/codes.ts`) for the scene, the labels and the icons. Fixes light freezing drizzle (56) and snow grains (77), which were treated as heavy (1 mm/h and 1.2 cm/h fallbacks).
- Units, requested API fields, override and shell keys (type-checked), quality tiers, render orders, tone exposure, frame-delta cap, scene palette, shared GLSL helpers, display formatting (`utils/format.ts`), math helpers, the forecast day count and the default location each defined once.
- The freezing level falls back to the standard lapse rate (was a flat 3 km); a debug-pinned cloud base is no longer overridden under fog.
- UI: `LineIcon`/`CloseIcon`, SCSS breakpoint and label mixins, accent tints derived from `--accent-warm`; narrow grids use `minmax(0, 1fr)` so long content can't overflow.

### Removed
- Dead code (no visible change):
  - **Scene.**
    - The frame-change trigger of SceneDriver's suncalc recompute: the display directions are recomputed every frame anyway.
    - The march's unused `vUv` varying, and `ViewFrame.pitch` (always the camera pitch).
    - The never-changing `uEarthR` / `uFadeFar` uniforms: GLSL constants interpolated from `EARTH_RADIUS_M` / `DECK_FAR`.
    - The lens flare's `uCloudsOn` branch: `signals.cloudCover` is a shared transparent 1×1 texture (`NO_CLOUD_COVER`) when there is no cloud target, which also replaced the clouds' own clear-sky texture.
    - Budget values captured into the cloud passes at mount, now placeholders written every frame.
    - WeatherScene's never-passed `className` / `style` props and its server-rendering guards (also in `useIsMobile`).
  - **UI.**
    - The debug menu's `DebugTools` object (a plain `showPerf` flag) and the never-passed `NumericField.half`.
    - The hero's `formatted` memo.
    - CSS restating what `liquid-glass` or the global rules already set (`position`, `box-sizing`, `font-family`), a mobile `.stats` rule identical to the desktop one, and a selector list that matched every icon button.
  - **Data and config.**
    - Optional forecast query params and their `undefined` filter (the one caller passes all), and a duplicate empty-string check in the geocoder.
    - `allowJs` / `resolveJsonModule` from `tsconfig.json` (no JS or JSON imports).
    - The unused Chakra Petch 700 weight from the font request.
    - The manifest's white background (the app is dark).
- Unread API fields (hourly precipitation probability and weather code, geocoder ids, response units), the generic endpoint parameter, the dead `NETWORK_ERROR` path and `getSunAltitude`.
- `react-dom/server` from the bundle (map marker is a static Leaflet `divIcon`): −197 kB (−60 kB gzip).
- The missing `logo192.png` link, the CRA `browserslist` and a second Toastify stylesheet (v11 injects its own).

### Scene
- Camera pitched up 22° (was 16°): the frame spans −3°…+47°, a thin horizon strip and mostly sky.
- Low decks: cloud noise (cover, shape, detail) scales with the deck's height (`uFeatureScale`, 0.2–1 of the cumulus size), so a 150–300 m deck is no longer one cell filling the frame.
- Stable cloud top: an inversion just above the base gives a thin deck (≥ 100 m) instead of a 900 m slab; with no cloudy pressure level, the first clear level above the base caps the top. Shell thickness may go down to 80 m.
- The sky turns grey only under a closing deck (≥ 80 % low / 85 % mid); broken decks keep blue gaps. The UI backlight uses a separate `cloudFill` signal with the old curve.

### Data
- The current weather label and icon are derived from the shown cloud cover for pure cloud codes (0–3), using Open-Meteo's thresholds (20 / 50 / 80 %). The 15-min `weather_code` is the step of the coming hour, while `cloud_cover` is interpolated ("Mainly clear" next to 66 %).

### UI
- One line-art `WeatherIcon` for the hero and the forecast tiles. It replaces the OpenWeatherMap PNGs hotlinked by the forecast and the hero's own mapping. Fixed: a bare sun for "mainly clear", a sun at night for "partly cloudy", rain/shower icons swapped, snowflakes for freezing rain, rain as the fallback. Day/night variants, intensity-scaled marks, rime fog, hail.
- README stack table: icons are our own SVGs (react-icons was never a dependency).

## 2026-10-12
- Cloud cover drawn as measured: calibrated coverage and cirrus; cirrus is no longer turned into cumulus; radiation-based optical depth trusted only for closing decks; debug pins no longer change real clouds.
- Adaptive cloud march (cheap steps through empty air, distance-scaled fine steps) with a variance-clipped temporal resolve; weather changes morph the clouds instead of resetting.
- API-driven cloud physics (LCL base, CAPE tops, radiation optical depth, winds aloft) and a procedural frosted glass that grows gradually.
- Adaptive liquid-glass UI driven by scene brightness; liquid-glass loaders; data stays readable (blurred) while refetching.
- Cursor edge reveal on every UI element, 5-tap debug entry on phones, two-line logo, map drawer on the dynamic viewport, lat/lon 0 fix.
- Removed the takram test renderer, the free camera, spawn-volume wireframes and unused deps.

## 2026-10-11
- Volumetric raymarched clouds with temporal accumulation; the flat deck stays as the potato-tier fallback.
- Frame gate renders every N-th display frame for even pacing.

## 2026-10-10 — scene rewrite
- New scene core: world frame, view volumes, quality tiers, scene signals and driver.
- Scene params in SI units from Open-Meteo (cloud layers, gusts, precipitation split, freezing, hail, grains, rime) with debug presets.
- drei Sky, sky grade, frame-only stars, phased moon; three.quarks precipitation; thunderstorm bolts with cloud flashes; diamond dust.
- Removed legacy simulation config, phase tables and dead WMO helpers.

## 2026-04
- New UI and API data; mobile view, gyroscope parallax, first frost effect; snowflake assets.

## 2026-02 – 2026-03
- Custom weather background engine (tiered clouds, weather effects, lens flare), react-leaflet map picker with a resizable drawer, debug menu and stats; dependency updates and refactors.

## 2025
- Switched from OpenWeatherMap to Open-Meteo; TypeScript migration; Vercel deploy and analytics.

## 2022
- First release (Create React App): search, current weather, weekly forecast.
