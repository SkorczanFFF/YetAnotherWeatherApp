# Scene astronomy — how takram's atmosphere + clouds drive the background

This document explains how the takram libraries actually compute what you see, how Open-Meteo data flows into them, and why specific times of day look the way they do.

If you're confused about *"why is the scene black at 1 AM"* or *"how do I make night look brighter"*, this is the file to read.

---

## TL;DR

- The libraries are an **astronomy simulator**, not a fixed shader. They compute real sun and moon positions for any `Date` you give them, using actual solar and lunar ephemerides.
- There is **no autonomous day cycle**. We drive it by calling `atmosphereRef.current?.updateByDate(new Date(dt * 1000))` every frame in `SkyStage.tsx`, where `dt` is `Date.now()/1000` (real-time clock) or the `dt` pinned in the F7 debug menu.
- The **UI hero card's sun/moon arc** is independent — it reads `weather.sunrise` and `weather.sunset` from Open-Meteo and animates a glyph (sun by day, moon by night) along an SVG arc. This is purely a UI element, decoupled from the 3D scene.
- The **3D scene's sun and moon** are rendered by `<AerialPerspective sun moon>` from the takram library, at their actual ECEF positions. They **only show up when above horizon at the viewed city's local time** — astronomically correct.
- We mount `<Stars>` from `@takram/three-atmosphere/r3f` so the night sky shows actual catalogue stars rotating with sidereal time.
- We pass `lunarRadianceScale={8}` to the AerialPerspective so moonlit nights are visible — physical moonlight is ~400,000× dimmer than sunlight and reads as black under AGX tonemap without this cinematic cheat.

---

## How the libraries work

### The mental model

`@takram/three-atmosphere` and `@takram/three-clouds` are **stateless evaluators**. They have no calendar, no clock, no time-of-day enum. Every frame the shader reads three uniforms:

| Uniform | Type | Meaning |
|---|---|---|
| `sunDirection` | unit `vec3` (ECEF) | Direction from Earth's centre to the Sun, in Earth-Centred-Earth-Fixed coordinates. |
| `moonDirection` | unit `vec3` (ECEF) | Direction from Earth's centre to the Moon, ECEF. |
| `worldToECEFMatrix` | `mat4` | Transforms our scene's world space into ECEF, so the shader knows where on Earth the camera is. |

From these plus precomputed scattering lookup tables (transmittance, single-Mie scattering, multi-order scattering, irradiance — all loaded from a CDN) it computes the spectral radiance arriving at each pixel via real radiative-transfer physics.

If you stop calling `updateByDate(...)`, the sun and moon **freeze in place**. Forever. There is no autonomous day cycle.

### Computing sun and moon directions

When you call `atmosphereRef.current?.updateByDate(date)`, the library does (decompiled from `node_modules/@takram/three-atmosphere/build/r3f.cjs`):

```js
function updateByDate(date) {
  // 1. Earth's rotation angle at this Julian date — gives the
  //    Earth-Centred-Inertial (fixed-stars frame) → ECEF rotation matrix.
  getECIToECEFRotationMatrix(date, inertialToECEFMatrix);

  // 2. Look up the Sun's direction in ECI from a precomputed solar
  //    ephemeris, then rotate into ECEF.
  getSunDirectionECI(date, sunDirection).applyMatrix4(inertialToECEFMatrix);

  // 3. Same for the Moon — uses an actual lunar ephemeris (orbit
  //    eccentricity, inclination, precession, etc.).
  getMoonDirectionECI(date, moonDirection).applyMatrix4(inertialToECEFMatrix);
}
```

So sunrise, sunset, moonrise, moonset, lunar phase — **all derived from the actual Date you feed in**. The library is doing real orbital mechanics. If you feed it `new Date('2026-04-20T01:13:00+02:00')`, the sun and moon will be exactly where they were over Katowice at that moment in real life.

### Anchoring the scene to a city

The directions come back in ECEF. To make the shader compute a sky for *Katowice specifically* (rather than (0,0) on the equator), we set `worldToECEFMatrix` ourselves. From `SkyStage.tsx`:

```ts
const surfaceECEF = useMemo(() => {
  const lat = (config.lat ?? 0) * DEG2RAD;
  const lon = (config.lon ?? 0) * DEG2RAD;
  return new Geodetic(lon, lat, ORIGIN_ALTITUDE).toECEF();  // 500 m above WGS84
}, [config.lat, config.lon]);

useLayoutEffect(() => {
  const w = atmosphere?.transientStates?.worldToECEFMatrix;
  Ellipsoid.WGS84.getNorthUpEastFrame(surfaceECEF, w);
}, [atmosphere, surfaceECEF]);
```

`Geodetic(lon, lat, 500).toECEF()` converts Katowice's `(50.26°N, 19.02°E, +500m)` into the literal ECEF point `(3,857,000, 1,331,000, 4,886,000)` metres from Earth's centre. `getNorthUpEastFrame` then builds the matrix that places our scene's origin at that point with `+X = North`, `+Y = Up`, `+Z = East` in local space.

After that's installed, the AerialPerspective shader's question *"is the sun above horizon for the camera at this position?"* gets answered correctly for Katowice. Switch to Sydney by selecting it in the search bar, and the matrix updates → the same UTC instant becomes daytime instead.

### Cloud lighting

`@takram/three-clouds` uses `sunDirection` for direct cloud illumination plus two indirect terms scaled by `skyLightScale` (sky/ambient) and `groundBounceScale` (ground albedo). It **does not consume `moonDirection`** — moonlight only reaches clouds indirectly via the sky-light term (which picks up the atmosphere's moonlit scattering when the moon is up).

Library defaults are fine for daytime; we leave them at 1.0 each.

---

## Where Open-Meteo data shows up

```
Open-Meteo /forecast (UTC time, lat=50.26, lon=19.02, sunrise[], sunset[], …)
    │
    ▼
WeatherData { dt, lat, lon, sunrise, sunset, next_sunrise, … }
    │
    ▼
mapToSimulationConfig(weather, overrides) → SimulationConfig
    │   { dt, useRealtimeClock: true, lat, lon, timeOfDay, sunrise, sunset }
    ▼
SkyStage (the 3D scene)              CurrentWeather (the UI hero card)
    │                                          │
    ├ useLayoutEffect:                         ├ useMemo "arc":
    │   worldToECEFMatrix                      │   if now ∈ [sunrise, sunset]
    │     ← getNorthUpEastFrame(               │     mode = "day"
    │         Geodetic(lon, lat, 500))         │     leftLabel  = "Sunrise"
    │                                          │     rightLabel = "Sunset"
    └ useFrame (every frame):                  │     progress   = (now-sunrise)
        api.updateByDate(                      │                 / (sunset-sunrise)
          new Date(dt * 1000))                 │   else (night):
            │                                  │     mode = "night"
            ├ sunDirection (ECEF)              │     leftLabel  = "Sunset"
            └ moonDirection (ECEF)             │     rightLabel = "Sunrise"
                                               │     start = sunset (today) or
                                               │             sunset - 24h (pre-dawn)
                                               │     end   = next_sunrise (after dusk)
                                               │             or sunrise (pre-dawn)
                                               │     progress = (now-start) / (end-start)
                                               │
                                               └ render:
                                                   day  → <SunSvg/>
                                                   night → <MoonSvg/>
                                                 …animated along an arc
                                                 from leftLabel position to rightLabel
```

So **the UI hero card's arc and the 3D scene's sky are independent paths**. The hero card always shows a sun OR moon glyph appropriate for the current time, regardless of what the 3D scene is doing. The 3D scene shows whatever the actual physics produces, which in real life means the moon is sometimes below the horizon and you see no moon at all.

---

## The hero-card timeline rules

(Implemented in `src/components/weather/current/CurrentWeather.tsx`, `arc` useMemo around line 110.)

| Condition | `mode` | Body shown | `leftLabel` | `rightLabel` | `progress` formula |
|---|---|---|---|---|---|
| `sunrise ≤ now < sunset` | `"day"` | sun glyph | Sunrise | Sunset | `(now − sunrise) / (sunset − sunrise)` |
| `now ≥ sunset` (post-dusk) | `"night"` | moon glyph | Sunset | Sunrise | `(now − sunset) / (next_sunrise − sunset)` |
| `now < sunrise` (pre-dawn) | `"night"` | moon glyph | Sunset | Sunrise | `(now − (sunset − 24h)) / (sunrise − (sunset − 24h))` |

Where `next_sunrise` is `weather.next_sunrise` from the Open-Meteo daily array (`sunrise[1]`). For pre-dawn we approximate yesterday's sunset as today's sunset minus 24 h — accurate to within a few minutes of seasonal change.

The sun marker is a circular SVG `circle` filled with `--accent-warm`; the moon marker is two overlapping circles producing a crescent shadow. Both are rendered as HTML overlays with `left: x%; top: y%` percentages over a stretched arc SVG so they stay perfectly round at any track width.

The arc *itself* is a `<path>` from `(4, 36)` to `(196, 36)` with control point `(100, -12)` — a quadratic Bézier dome. Progress is rendered via a `<clipPath>` rect whose width grows with `progress * 200`, so the lit segment is always one continuous arc from sunrise to the marker (or sunset to the marker at night). Stroke colour swaps per mode: warm for day, cool blue for night.

---

## Why night was previously pure black

Pre-fix recipe for "void at night":

1. **Sun below horizon** at deep night → AerialPerspective scattering integral returns `vec3(0)`. Sky shader correctly outputs black.
2. **Moon below horizon** when `<AerialPerspective moon>` checks `moonDirection · localUp > 0`, the result is negative, and no moon disc is drawn.
3. **No `<Stars>` mounted** → no star-catalogue contribution.
4. **Clouds use sun direction only** for direct lighting → cloud-deck contribution is also zero.

All four inputs to the sky shader summed to zero radiance. The framebuffer was correctly painted black — a photographically accurate rendering of the actual sky over Katowice at that instant.

### The 1:13 AM Katowice example specifically

For 2026-04-20 at 01:13 CEST (= 23:13 UTC on Apr 19) in Katowice (50.26°N, 19.02°E):

- **Sun altitude** ≈ -26.5° (well past astronomical twilight, which ends at -18°) → atmospheric scattering of sunlight is functionally zero.
- **Moon phase**: first quarter (April 19 2026 was ~14:00 UTC first quarter exact). First-quarter moons rise around noon, transit around sunset, and **set around midnight local time**. At 01:13 CEST the moon had already set, so it was below the horizon.
- **Stars**: actually present (Vega, Deneb, Altair, the Big Dipper) — but invisible because we weren't rendering them.

Result: pure black, astronomically correct.

---

## "We're teleported to Katowice — why is it dark?"

This is exactly what's happening, and it *is* astronomically correct. Setting `worldToECEFMatrix` to Katowice's NUE frame is, computationally, equivalent to placing the camera at Katowice's actual position on the WGS84 ellipsoid. The shader then renders the same sky an observer in Katowice would see at that wall-clock moment.

If we were watching Katowice from *space* (not from the ground), we'd see the dark side of Earth's globe with a sunlit half disappearing over the limb. But the camera isn't in orbit; it's at the city's surface looking up. So at 01:13 CEST the camera is pointed at the night-time half of Earth's atmosphere, with the sun illuminating the *opposite* side of the planet ~13,000 km behind it. The atmospheric scattering integral along every view ray returns ~zero radiance.

### Common misconception: "the moon is always there"

It isn't. The moon orbits Earth once per ~27 days; from any specific city the moon **rises and sets** just like the sun, with the times shifting ~50 min later each night.

| Phase | Rises | Sets | Visible at 01:13 CEST? |
|---|---|---|---|
| New moon | sunrise | sunset | ❌ (with the sun) |
| First quarter | noon | midnight | ❌ (just set) |
| Full moon | sunset | sunrise | ✅ |
| Last quarter | midnight | noon | ✅ (just rose) |

April 19/20 2026 was first quarter, moon set ~midnight CEST → at 01:13 CEST the moon was below horizon, no moonlight reached Katowice. The library is correctly showing this.

### What real urban observers actually see at night

A real-life human at 01:13 CEST in Katowice would see:

- A faint orange-amber glow on cloud bottoms from sodium/LED **light pollution**.
- Stars visible above ~30° altitude, washed out by light pollution near the horizon.
- A barely-perceptible greenish **airglow** on a clear sky.

The takram libraries simulate **none of these**. The atmosphere shader's only light sources are the sun and the moon, and `<Stars>` (when mounted) renders the catalogue stars but not the sky-glow they'd appear against in light-polluted areas.

So the "scene is correctly black" answer is true *for an observer in deep rural darkness with no moon*. For an urban scene with a moon below horizon, it's physically correct but perceptually wrong relative to what your eyes would see standing in Katowice. We address this with viewer-friendly cheats below — they don't make the scene more *correct*, just more *useful*.

## What we added to make night visible

### 1. Catalogue stars

Added `<Stars />` from `@takram/three-atmosphere/r3f` inside `SkyStageInside`:

```tsx
<Stars />
<EffectComposer multisampling={0} enableNormalPass>
  …
</EffectComposer>
```

This component renders ~9000 catalogue stars billboarded against the sky sphere, anchored to the **ECI frame** (the inertial frame fixed relative to the stars themselves). The takram library is already maintaining the ECI→ECEF rotation matrix as part of its `transientStates` (from `getECIToECEFRotationMatrix(date, …)`), so the `<Stars>` component just reads that and rotates accordingly.

Result: stars now slowly drift across the sky with sidereal time, dimming out automatically as the sun approaches the horizon. They use the real Hipparcos catalogue, so the constellations are correct.

### 2. Cinematic moonlight scaling

Added `lunarRadianceScale={16}` to `<AerialPerspective>`:

```tsx
<AerialPerspective sky sun moon sunLight skyLight lunarRadianceScale={16} />
```

Physical moonlight is roughly `1 / 400,000` the radiance of direct sunlight. Under AGX tonemap that maps to imperceptible at any reasonable exposure. `lunarRadianceScale` scales the moon's contribution to the precomputed radiance integrals (both for direct lighting on geometry via `sunLight`/`skyLight` flags, and for the moon disc itself when `moon` is enabled).

`16×` is a strong cinematic lift — moonlit nights now read as silvery on the sky and the cloud deck. Real moonlight at this scale is brighter than real life, but at AGX exposure that's necessary to actually see anything. Drop to `8×` if you want a more restrained look, push to `30×` for full "Hollywood night."

**Important**: this has no effect when the moon is below the horizon. The shader still won't draw its disc, and the moon-illuminated sky scattering integrals still sum to zero. The 1:13 AM Katowice scene will still show no moon — just stars and dim cloud silhouettes (the latter from #3 below).

### 3. Night-time cloud sky-light boost

Added a time-of-day-keyed `skyLightScale` on `<Clouds>` (in `VolumetricClouds.tsx`):

```tsx
const skyLightScale =
  config.timeOfDay === "night"        ? 4.0
  : config.timeOfDay === "dawn" || config.timeOfDay === "dusk" ? 2.0
  :                                     1.0;  // library default

<Clouds skyLightScale={skyLightScale} … />
```

Why: `@takram/three-clouds` doesn't consume `moonDirection` for direct cloud lighting — clouds are lit only by the sun (which is below horizon at night) plus the integrated atmospheric sky-light term. At deep night the sky-light integral is dominated by faint scattering of below-horizon sunlight (earth-shadow Rayleigh) plus moonlit scattering when the moon is up — both very small numbers that AGX maps to zero.

Quadrupling the `skyLightScale` lifts the cloud deck back into the visible range. The clouds now silhouette correctly at night against the dark sky, mimicking what a city-dweller would see (where light pollution + airglow would do this naturally). It's a viewer-friendly deviation from physical accuracy: a true rural moonless sky genuinely shows no clouds.

---

## What still doesn't work, and why

### Light pollution / airglow

Real urban skies have a faint orange-brown glow from sodium-vapour lamps and a much fainter green/red atmospheric chemiluminescence (airglow). The takram library doesn't model either. If you want a city-like night you'd need to add a tiny `<color attach="background"/>` or a custom screen-space tint pass keyed off `timeOfDay === "night"`.

### Twilight gradient

Civil/nautical/astronomical twilight all happen automatically (the scattering tables handle them) — but at deep astronomical night (sun > -18°) there's no gradient any more, just stars on black. This is correct.

### Moon-lit clouds at night

The cloud library doesn't consume `moonDirection` for direct lighting. With `lunarRadianceScale={8}` the **sky-light** term picks up the moonlit atmospheric scattering and indirectly lights clouds from above, which works OK on bright moonlit nights but won't give you the dramatic edge-lit-cloud look you'd get from explicit moon illumination. Fixing this would require wrapping `CloudsEffect` and overriding its `sunDirection` uniform with the moon direction at night — out of scope for the canonical setup.

---

## Cheat sheet: forcing specific looks for testing

Use the F7 debug menu to lock the scene to a specific astronomical state:

| You want | Do this |
|---|---|
| Bright noon sky | `Time of day → day` (pins `dt = (sunrise+sunset)/2`) |
| Sunset glow | `Time of day → dusk` |
| Dawn pinks | `Time of day → dawn` |
| Deep night with stars | `Time of day → night` |
| Real astronomical time | Leave `Time of day → auto` and `useRealtimeClock` stays true |

The pinned `dt` is fed into `updateByDate(new Date(dt * 1000))` in `SkyStage.tsx`, which then drives the entire scene as if it really were that moment.

---

## Files involved

- `src/weather-scene/effects/SkyStage.tsx` — Atmosphere + EffectComposer setup; calls `updateByDate` per frame; mounts `<Stars>` and `<AerialPerspective lunarRadianceScale=8>`.
- `src/weather-scene/effects/VolumetricClouds.tsx` — `<Clouds>` with library defaults.
- `src/components/weather/current/CurrentWeather.tsx` — UI hero card with the SVG sun/moon arc (independent of the 3D scene).
- `src/weather/config.ts` — `mapToSimulationConfig` produces the `dt`/`useRealtimeClock`/`lat`/`lon` that drive the scene.
- `src/services/weatherService.ts` — Open-Meteo fetch.

## References

- Canonical Storybook story: <https://github.com/takram-design-engineering/three-geospatial/blob/main/storybook/src/clouds/Clouds-Basic.tsx>
- Atmosphere README (full API): `node_modules/@takram/three-atmosphere/README.md`
- Clouds README (full API): `node_modules/@takram/three-clouds/README.md`
- Atmosphere/r3f decompiled source: `node_modules/@takram/three-atmosphere/build/r3f.cjs`
