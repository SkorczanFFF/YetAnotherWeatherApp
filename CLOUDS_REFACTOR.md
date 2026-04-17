# Volumetric Clouds Refactor

> Implementer runbook. Follow top-to-bottom. Every section is actionable.

---

## 1. Executive summary

The current cloud system renders up to ~4 600 individual `THREE.Mesh` instances of `RoundedBoxGeometry` per frame (chamfered cubes stacked by a seeded RNG). It is fast enough but visually dated — hard silhouettes, no internal lighting, no self-shadowing, no scattering. This refactor replaces the geometry-based clouds with **true raymarched volumetrics** via `@takram/three-clouds`, running inside a `postprocessing` `EffectComposer` and composited via `AerialPerspectiveEffect`.

**Expected outcome.**

- Visual: physically-based cloud shape, density, self-shadowing, light scattering, aerial perspective at distance.
- Perf: fewer draw calls, one full-screen raymarch pass instead of thousands of mesh draws; controllable via quality presets.
- Code: the entire tier/box-builder/spawn/recycle subsystem is retired.

**Geospatial caveat (biggest risk, addressed in §4 and §5).** `@takram/three-clouds` is designed for planetary scenes: meters, ellipsoid altitudes, shape textures tiling once per kilometer, composited through `<Atmosphere>`. This app is a fixed-camera local scene (`z = 5`, hand-tuned `y` 7–15). We adapt by (a) adopting `<Atmosphere>` and retiring `SkyBackground`, and (b) scaling the scene world up by 1 000× (or conceptually treating current units as km).

---

## 2. Current state audit

### Files replaced or deleted

| Path | Role | Fate |
|---|---|---|
| `src/weather-scene/effects/CloudEffect.tsx` | React component, owns group + useFrame loop | **Delete.** Replaced by `VolumetricClouds.tsx`. |
| `src/weather-scene/effects/clouds/cloudBuilder.ts` | Seeded RNG stacks 1–30 axis-aligned boxes per cloud | **Delete.** |
| `src/weather-scene/effects/clouds/cloudSpawning.ts` | Upwind-biased random position inside AABB | **Delete.** |
| `src/weather-scene/effects/clouds/cloudTiers.ts` | 5 tiers (light/medium/overcast/extreme/fullcover) × count/yRanges/sizeWeights/scale/opacity | **Delete.** Replaced by single `cloudProps.ts` that maps `SimulationConfig` → `Clouds` props. |
| `src/weather-scene/effects/clouds/cloudColor.ts` | Rain/thunderstorm grayscale lookup | **Delete.** Clouds are now lit physically by the atmosphere. |
| `src/weather-scene/effects/clouds/cloudConstants.ts` | `CLOUD_WIND_FACTOR`, `CLOUD_FADE_IN_DURATION`, visible near/far, recycle cap | **Delete.** Constants move to `cloudProps.ts` or disappear. |
| `src/weather-scene/cameraFrustum.ts` | AABB spawn bounds from camera FOV × aspect | **Delete.** The new lib fills the viewport automatically — see §7. |
| `src/weather-scene/effects/SkyBackground.tsx` | Scene background texture (time-of-day gradient, storm tint) | **Delete** under Option A (§4). |

### Metrics today (for regression comparison)

- `light` tier: 50 clouds × avg 2 boxes ≈ 100 meshes.
- `medium`: 80 × ~6 ≈ 480.
- `overcast`: 120 × ~11 ≈ 1 320.
- `extreme`: 160 × ~18 ≈ 2 880.
- `fullcover`: 200 × ~23 ≈ 4 600 meshes.
- One `MeshBasicMaterial` per box (no instancing).
- Recycle budget: 3 clouds/frame.

### Why it is inadequate

- Hard polygonal silhouettes; chamfer radius of 0.2 on a unit cube does not hide the box edges at tier-large scales.
- No internal lighting — `MeshBasicMaterial` is unlit, so grayscale shifts fake the illusion.
- No self-shadowing; no sun occlusion of clouds behind clouds.
- Lens-flare occlusion raycast runs a Vogel spiral through cloud meshes; looks noisy at high cover.
- Draw-call heavy at storm densities.

---

## 3. Target approach — `@takram/three-clouds`

### Dependencies to install

Pin the latest stable at install time. Current-known-good version families (verify on npm at impl time):

```bash
npm install @takram/three-clouds @takram/three-atmosphere \
            @react-three/postprocessing postprocessing
```

Peer-dep matrix (must satisfy):

- `three` — already `^0.183.1` ✓
- `@react-three/fiber` — already `^9.5.0` ✓
- `@react-three/drei` — already `^10.7.7` ✓

### WebGL 2 requirement

The library requires WebGL 2 (`Data3DTexture`, `postprocessing` pipeline). Add a one-time capability check at app boot:

```ts
const canvas = document.createElement("canvas");
const hasWebGL2 = !!canvas.getContext("webgl2");
```

If `hasWebGL2 === false`, render a simpler fallback (drei `<Clouds>`) and log a console warning. Treat the fallback as a follow-up; do not block shipping on it.

### Composition pattern

```tsx
<Atmosphere>
  <EffectComposer enableNormalPass>
    <Clouds qualityPreset={preset} coverage={coverage} {...animationProps} />
    <AerialPerspective sky sunLight skyLight />
  </EffectComposer>
</Atmosphere>
```

`Clouds` must be placed **before** `AerialPerspective` in the composer chain. `AerialPerspective` composites the cloud buffer into the final sky.

---

## 4. Sky / atmosphere reconciliation (the big one)

Two options. Recommended is **Option A**.

### Option A — Adopt `<Atmosphere>` (recommended)

- Delete `SkyBackground.tsx`. The atmosphere model owns the sky colour.
- Keep `CelestialBodies.tsx` but **drive its sun vector from the atmosphere's sun direction**, not from the current `getSunProgress` math. See §10.
- Keep the moon sprite, stars, and lens flare. They render in-scene, above the atmosphere compositing, and continue to work.
- Lose the author-tuned time-of-day colour palette. Gain physically-based dawn/dusk gradients and Rayleigh scattering.

**Cost.** Art-direction delta on sky colour. Test with the current `getTimeOfDayPhase` phases (`night` / `dawn` / `day` / `dusk`) and compare.

### Option B — Skip `<Atmosphere>`

- Use the raw `CloudsEffect` inside a bare `EffectComposer`, feed a manually computed sun direction, leave `SkyBackground` as-is.
- The npm page describes clouds as "primarily intended to render clouds into buffers and then composited in `AerialPerspectiveEffect`" — without `AerialPerspective`, clouds will not sit correctly against the painted sky. Expect a floating/unlit look.
- Use this only as a debugging aid, not as the shipping configuration.

**Decision:** adopt Option A.

---

## 5. World-scale strategy

The library operates in meters with shape textures tiling at 1 km period. Current scene units are sub-20. Two options; **Option A (uniform scale-up) is recommended**.

### Option A — Uniform scale-up (recommended)

- Treat current units as kilometers. Multiply all world dimensions by 1 000.
- `camera.position.z = 5000`; update `CameraRig.PARALLAX` multiplier and `FIXED_CAMERA_Z` accordingly.
- Cloud base altitude: 7 000 – 15 000 m (matches the current 7–15 unit y-ranges, reinterpreted as km in meters).
- Camera near/far updated: near ≈ 1, far ≈ 200 000.
- Wrap every other effect in a `<group scale={1/1000}>` compensator so Rain/Snow/Mist/Lightning/Fog math keeps working unchanged.

Constants that move:

| Old | Old value | New value |
|---|---|---|
| `FIXED_CAMERA_Z` (`cameraFrustum.ts`) | `5` | delete (camera lives at 5000 m) |
| `SPAWN_PADDING` / `RECYCLE_PADDING` | `8` / `14` | delete with the file |
| y-range floors in `cloudTiers.ts` | `5..15` | delete with the file |
| `CameraRig` `PARALLAX` | `2` units | `2000` m |
| Fog density | `0.02..0.1` per unit | recompute per meter if fog is kept (see §11) |

### Option B — Override library uniforms

- Keep scene at current units.
- Patch the library's `localWeatherRepeat`, `shapeRepeat`, `detailRepeat` uniforms each frame to tile correctly at small world scale.
- Riskier: the library is pre-1.0 and uniform names may shift; easy to produce shimmering.

**Decision:** adopt Option A.

---

## 6. Redesigned cloud control surface (replaces tiers)

Map `SimulationConfig` (from `src/weather/config.ts`) → `Clouds` props. All mapping lives in one file.

### New file: `src/weather-scene/effects/volumetricClouds/cloudProps.ts`

```ts
import { Vector2, Vector3 } from "three";
import type { SimulationConfig } from "../../types";

export interface CloudsRuntimeProps {
  coverage: number;
  densityScale: number;
  localWeatherVelocity: Vector2;
  shapeVelocity: Vector3;
  shapeDetailVelocity: Vector3;
  // Extend with extinction/scatter overrides as needed.
}

const WIND_TO_LOCAL_WEATHER = 0.0005;   // Tune at impl time.
const WIND_TO_SHAPE = 0.002;
const WIND_TO_DETAIL = 0.01;

export function buildCloudsProps(config: SimulationConfig): CloudsRuntimeProps {
  const rad = (config.windDirection * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirZ = -Math.cos(rad);

  const coverage = config.cloudCover ?? 0;
  const densityBoost = config.thunderstorm ? 1.25 : 1;
  const densityScale = (config.cloudOpacity ?? 1) * densityBoost;

  return {
    coverage,
    densityScale,
    localWeatherVelocity: new Vector2(
      dirX * config.windSpeed * WIND_TO_LOCAL_WEATHER,
      dirZ * config.windSpeed * WIND_TO_LOCAL_WEATHER,
    ),
    shapeVelocity: new Vector3(
      dirX * config.windSpeed * WIND_TO_SHAPE,
      0,
      dirZ * config.windSpeed * WIND_TO_SHAPE,
    ),
    shapeDetailVelocity: new Vector3(
      dirX * config.windSpeed * WIND_TO_DETAIL,
      0,
      dirZ * config.windSpeed * WIND_TO_DETAIL,
    ),
  };
}
```

### Mapping table

| `SimulationConfig` field | `Clouds` prop | Notes |
|---|---|---|
| `cloudCover` (0–1) | `coverage` | 1:1 |
| `windSpeed` + `windDirection` | `localWeatherVelocity`, `shapeVelocity`, `shapeDetailVelocity` | Three wind-factor constants — tune during verification. |
| `thunderstorm` | `densityScale *= 1.25` | Plus lightning keeps firing from `LightningEffect`. |
| `effectType === "snow"` | lower cloud base altitude, higher coverage floor | Tune per effect in a helper above `buildCloudsProps`. |
| `timeOfDay` / `dt` / `sunrise` / `sunset` | nothing direct — sun angle flows through `<Atmosphere>` | Single source of truth. See §10. |
| `cloudOpacity` (debug) | `densityScale` multiplier | DebugMenu parity. |
| `cloudColorOverride` (debug) | `extinctionColor` override | DebugMenu parity; may require library-specific uniform name verified at impl time. |

### Fade on cover change

`CLOUD_FADE_IN_DURATION` (3 s) is no longer per-cloud — it becomes a lerp of `coverage` toward the target value:

```ts
const coverageRef = useRef(0);
useFrame((_, dt) => {
  coverageRef.current += (targetCoverage - coverageRef.current) * (1 - Math.exp(-dt / 3));
});
```

---

## 7. Camera-POV culling ("spawn only in view")

### Key realisation

There is no per-cloud spawn anymore. `@takram/three-clouds` runs as a **full-screen post-processing pass** that raymarches the cloud volume per pixel. Whatever the camera sees, the shader computes — nothing is sampled outside the viewport. The user's "spawn only in view" requirement is satisfied by definition once we stop creating `THREE.Mesh` instances.

### What this closes

- `TODO.md` line "Dynamic cloud spawn area based on screen width" — **resolved**. Remove the TODO entry entirely.
- `cameraFrustum.ts` (file) — **delete**. No consumer left.
- `src/weather-scene/effects/clouds/cloudSpawning.ts` — **delete**.

### What this does not close

- The raymarch itself gets more expensive at higher FOV and higher DPR. Cover that in §8.

---

## 8. Mobile / perf safeguards

### Device detection

No new dependency. Put this in `src/weather-scene/effects/volumetricClouds/qualityPreset.ts`:

```ts
export type CloudsQualityPreset = "low" | "medium" | "high" | "ultra";

export function detectCloudsPreset(): CloudsQualityPreset {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const mobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (mobileUA && (cores <= 4 || dpr >= 2)) return "low";
  if (mobileUA) return "medium";
  if (cores <= 4) return "medium";
  return "high";
}
```

`"ultra"` is reserved for an opt-in toggle in the debug menu.

### Preset → library settings

| Preset | `qualityPreset` | `resolutionScale` | `temporalUpscale` | `shadow.cascadeCount` |
|---|---|---|---|---|
| `low` | `"low"` | `0.5` | `true` | `1` |
| `medium` | `"medium"` | `0.75` | `true` | `2` |
| `high` | `"high"` | `1.0` | `true` | `3` |
| `ultra` | `"ultra"` | `1.0` | `true` | `3` |

### WebGL 2 fallback

Gate the volumetric path behind `hasWebGL2` (see §3). If false, render drei `<Clouds>`/`<Cloud>` instances at the same altitudes, driven from `buildCloudsProps`. This is a follow-up; stub the branch now with a `TODO: WebGL1 fallback` comment.

### Debug "clouds off" toggle

Add an entry to `DebugMenu` (F7 key) that sets `coverage = 0` and disables the effect entirely. Useful for mobile triage.

---

## 9. Animation model

- **Coverage fade** on cover changes — see §6, `coverageRef` lerp (3 s time constant).
- **Wind** — delivered through `localWeatherVelocity`, `shapeVelocity`, `shapeDetailVelocity`. Three different factors let high-frequency detail drift faster than the synoptic-scale weather pattern, which reads as natural cloud movement.
- **Lightning** — keep `LightningEffect.tsx` unchanged. Subscribe `VolumetricClouds` to the same flash-event ref (via `SceneRefsContext`) and pulse `densityScale *= 1.15` for one frame when a flash fires. This makes clouds visibly lit from inside during thunderstorms.
- **Minimum drift** — the current `MIN_DRIFT_X` floor kept clouds from sitting perfectly still in calm weather. Replicate it by flooring `Math.abs(localWeatherVelocity.x)` to `0.0001` when both components are near zero.

---

## 10. Lighting integration

The scene currently has two sun-angle owners:

- `CelestialBodies.tsx` (line ~113) — `getSunProgress(dt, sunrise, sunset)` → sun sprite position and a PointLight direction.
- `SkyBackground.tsx` — time-of-day gradient keyed to the same `dt`.

After the refactor, **`<Atmosphere>` is the single source of truth**.

### New file: `src/weather-scene/effects/volumetricClouds/sunDirection.ts`

```ts
import { Vector3 } from "three";

/** Convert date-time + sunrise/sunset into a normalized world-space sun direction. */
export function computeSunDirection(
  dt: number,
  sunrise: number,
  sunset: number,
  out: Vector3 = new Vector3(),
): Vector3 {
  const dayLength = Math.max(1, sunset - sunrise);
  const t = (dt - sunrise) / dayLength;            // 0 at sunrise, 1 at sunset
  const angle = (t - 0.5) * Math.PI;               // -π/2 at sunrise, 0 at noon, +π/2 at sunset
  out.set(Math.cos(angle), Math.sin(angle), 0.0);  // east-up-west arc
  return out.normalize();
}
```

### Wiring

1. Add `sunDirection: React.MutableRefObject<Vector3>` to `SceneRefsContext`.
2. A single `useFrame` hook in `VolumetricClouds.tsx` updates the ref from `computeSunDirection(config.dt, config.sunrise, config.sunset)`.
3. `<Atmosphere sunDirection={sunDirectionRef.current}>` consumes it.
4. `CelestialBodies.tsx` reads the same ref for sun sprite placement, lens flare source, and `sunLight.position` — replacing the current local `getSunProgress` call.

The moon keeps its own logic (no atmosphere involvement needed).

---

## 11. Files to modify / add / delete

### Add

- `src/weather-scene/effects/VolumetricClouds.tsx` — the new effect component (`<Atmosphere>` + `<EffectComposer>` + `<Clouds>` + `<AerialPerspective>`).
- `src/weather-scene/effects/volumetricClouds/cloudProps.ts` — `SimulationConfig` → `Clouds` props (see §6).
- `src/weather-scene/effects/volumetricClouds/qualityPreset.ts` — device → preset (see §8).
- `src/weather-scene/effects/volumetricClouds/sunDirection.ts` — shared sun-direction utility (see §10).

### Modify

- `src/weather-scene/WeatherScene.tsx`
  - Replace `<CloudEffect config={…} />` with `<VolumetricClouds config={…} />`.
  - Wrap children that still live in world units in `<group scale={1/1000}>` (see §5).
  - Update camera to `position=[0, 0, 5000]`, `fov=75`, `near=1`, `far=200000`.
- `src/weather-scene/effects/CelestialBodies.tsx` — consume `sunDirectionRef` from `SceneRefsContext`; delete local `getSunProgress` dependency for the sun vector (keep it only for the sprite opacity curve if it is also used there).
- `src/weather-scene/effects/FogEffect.tsx` — either retire (aerial perspective replaces distance fog) or reduce `FogExp2` density by ~10× and keep only for rain/snow near-ground haze.
- `src/weather-scene/scene/CameraRig.tsx` — `PARALLAX` and `FIXED_CAMERA_Z` constants scale up 1 000×.
- `src/weather-scene/SceneRefsContext.tsx` — add `sunDirectionRef`.
- `package.json` — add the four new deps; pin versions at impl time.
- `TODO.md` — remove the "Dynamic cloud spawn area" entry (resolved).

### Delete

- `src/weather-scene/effects/CloudEffect.tsx`
- `src/weather-scene/effects/clouds/cloudBuilder.ts`
- `src/weather-scene/effects/clouds/cloudSpawning.ts`
- `src/weather-scene/effects/clouds/cloudTiers.ts`
- `src/weather-scene/effects/clouds/cloudColor.ts`
- `src/weather-scene/effects/clouds/cloudConstants.ts`
- `src/weather-scene/effects/clouds/` (whole directory, after its files are gone)
- `src/weather-scene/cameraFrustum.ts`
- `src/weather-scene/effects/SkyBackground.tsx`

---

## 12. Risks & rollback

### Risks

- **Scale-up risk.** Rain, snow, mist, lightning, parallax, and fog all assume sub-20 units. Compensator group mitigates but requires per-effect verification. Expect 0.5–1 day of tuning.
- **Atmosphere rewrite risk.** The current sky colour palette is hand-authored and reviewed. Physically-based sky may look "wrong" next to the brand. Budget a review cycle with design.
- **Bundle size.** Estimate (to be confirmed): `postprocessing` (~120 KB), `@react-three/postprocessing` (~30 KB), `@takram/three-atmosphere` (~80 KB), `@takram/three-clouds` (~150 KB) — roughly +380 KB gzipped. Run `npm run build` before/after and record the delta.
- **Mobile GPU risk.** Raymarched volumetrics are the single most expensive shader in this scene. The preset ladder (§8) mitigates but does not eliminate. Ship with the "clouds off" debug toggle and measure on real devices.
- **Library maturity.** `@takram/three-clouds` is pre-1.0. API may change. Pin exact versions (`=`, not `^`) in `package.json`. The "seams at poles" caveat on npm is irrelevant for us (we are not on a globe).

### Rollback

- Every deletion is recoverable from git. A single `git revert <refactor-commit>` restores the chamfered-box clouds, `SkyBackground`, `cameraFrustum`, and all five `clouds/*` files.
- If the refactor ships and later proves too expensive on mobile, the "clouds off" debug toggle gives ops a kill switch without reverting.

---

## 13. Verification checklist

Manual steps for the implementer to sign off before merging:

- [ ] `npm install` succeeds with no peer-dep warnings.
- [ ] `npm start` launches with no console errors or shader-compile warnings.
- [ ] `npm run build` succeeds; record bundle-size delta.
- [ ] Visual check at each of the 5 WMO cover buckets (`cloudCover` = `0.1`, `0.4`, `0.75`, `0.9`, `1.0`) via `DebugMenu`.
- [ ] Visual check at each `timeOfDay` phase (`night` / `dawn` / `day` / `dusk`) — sun direction matches sprite position.
- [ ] Thunderstorm condition: lightning flashes visibly light cloud interiors.
- [ ] Snow effect: cloud base visibly lower; cover saturates earlier.
- [ ] 1440p window: no empty edges at the horizon (closes TODO).
- [ ] Mobile emulation (Chrome DevTools: DPR 3, CPU 4×slowdown): ≥ 30 fps at `"low"` preset.
- [ ] Real mobile device (any iOS + any Android): ≥ 30 fps at `"low"` preset.
- [ ] Parallax (mouse + gyro) still feels smooth; no sky tearing.
- [ ] Lens flare still occludes correctly when clouds cover the sun.
- [ ] Debug `cloudColorOverride` and `cloudOpacity` still affect the visual.
- [ ] "Clouds off" debug toggle works.
- [ ] TODO.md entry removed.
- [ ] Old files listed in §11 are all deleted.

---

## 14. Implementation sequencing

Commit-sized steps. Each one should be reviewable on its own.

1. **Install deps + skeleton.** Add `@takram/three-clouds`, `@takram/three-atmosphere`, `@react-three/postprocessing`, `postprocessing`. Create `VolumetricClouds.tsx` as an empty component. No visual change yet.
2. **Atmosphere behind flag.** Add `<Atmosphere>` + `<AerialPerspective sky />` gated behind a debug flag alongside existing `SkyBackground`. Verify physically-based sky renders at every `timeOfDay` phase.
3. **Add `Clouds` with hardcoded props.** `coverage: 0.5`, `qualityPreset: "high"`. Verify clouds render on desktop.
4. **Unify sun direction.** Create `sunDirection.ts`, add `sunDirectionRef` to context, refactor `CelestialBodies` to consume it. Verify sun sprite and atmosphere agree.
5. **Wire `SimulationConfig` → props.** Create `cloudProps.ts`. Hook up to `VolumetricClouds`. Remove hardcoded props. Verify all 5 cover buckets and wind response.
6. **Retire old clouds.** Delete `CloudEffect`, `cloudBuilder`, `cloudSpawning`, `cloudTiers`, `cloudColor`, `cloudConstants`. Update `WeatherScene` to stop importing them. Close visual parity gaps.
7. **World-scale switch.** Scale up by 1 000×. Wrap non-cloud effects in compensator group. Tune `CameraRig` constants, camera near/far. Verify rain/snow/mist/lightning/parallax still look right.
8. **Mobile preset.** Add `qualityPreset.ts` and device detection. Add "clouds off" debug toggle.
9. **Thunderstorm + snow tuning.** Add lightning → `densityScale` pulse. Tune snow-mode cloud base altitude.
10. **Retire `SkyBackground` + `cameraFrustum`.** Remove the debug flag from step 2. Delete `SkyBackground.tsx`, `cameraFrustum.ts`. Scale down `FogEffect` density or retire it.
11. **TODO + verification.** Remove TODO.md entry. Run the full §13 checklist.

Target: 1–2 weeks of focused work. Land steps 1–3 first to de-risk the atmosphere integration.

---

# Part 2 — Lens Flare, God Rays & Natural Sunlight Refactor

> Depends on Part 1. Do not start Phase 3 (§15 onward) until Part 1 steps 1–3 are in: `EffectComposer` is mounted, `<Atmosphere>` + `<AerialPerspective>` is rendering, and `<Clouds>` is producing a density buffer.

---

## 15. Executive summary (Phase 3)

Part 1 moves clouds to a full-screen raymarched post-processing pass, which **breaks the current mesh-raycast occlusion** used by the Three.js `Lensflare`. Part 2 rebuilds the sun/moon flare and adds volumetric light shafts so sunlight reads as physically plausible.

**What changes.**
- Replace `three/examples/jsm/objects/Lensflare.js` with `@react-three/postprocessing`'s `LensFlare` effect.
- Add `three-good-godrays` for screen-space raymarched light shafts.
- Occlusion is sampled **directly from the `@takram/three-clouds` intermediate density buffer** — the flare and godrays attenuate precisely where clouds actually block the sun on screen.
- Delete the decorative `THREE.PointLight` sun; scene illumination already comes from `<Atmosphere sunLight>` (Part 1 §4).
- Add a second, cooler, smaller `LensFlare` for the moon using the same occlusion pipeline.

**Why.** User requirement: "real life, natural sunlight and lens flare effect, which is calculated with clouds overlay." The density-buffer sample is what makes "calculated with clouds overlay" real — not a heuristic, not scene-depth fakery.

---

## 16. Current lens-flare audit

Today:

- **Primitive:** Three.js `Lensflare` (`three/examples/jsm/objects/Lensflare.js`) attached to the sun `PointLight`.
- **Elements:** 3 × procedural radial-gradient `CanvasTexture`s (sizes 620 / 340 / 130 px at distances 0 / 0.4 / 0.7 along the sun-to-screen-center ray).
- **Colour:** lerps `0xffb347` (warm) → `0xfff5e6` (white) on `smoothstep(0.3, 0.8, cloudCover)`.
- **Occlusion:** 8-sample Vogel disc raycast against `cloudGroup.children` every `FLARE_RAYCAST_INTERVAL = 3` frames. Opacity compositing `1 − (1 − acc) × (1 − hit)`, early-exit at 0.95.
- **Attenuation:** `occlusion × smoothstep(0, 0.25, elevation) × (storm ? 0 : 1)`, smoothed with an exponential lerp at `FLARE_LERP_SPEED = 3.0` (≈ 0.33 s time constant).
- **No ghosts, no anamorphic streaks, no starburst, no chromatic dispersion.**
- **Mobile:** no DPR scaling on `pixelSize`; no device gating; raycast throttle is the only optimisation.
- **Moon:** has no flare at all.
- **Sun `PointLight`:** intensity 2, distance 500, warm orange — decorative (current materials are `MeshBasicMaterial`, which does not respond to lights). Redundant once atmosphere sunlight is in.

File map:

| Concern | Path | Notes |
|---|---|---|
| Flare + sun + moon + occlusion | `src/weather-scene/effects/CelestialBodies.tsx` | Lines 6–8 imports; 40–80 `SUN`/`MOON`/flare constants + Vogel `DISC_SAMPLES`; 91–111 `LENS_FLARE_ELEMENTS`; 175–236 `useCelestialLights` builds `Lensflare`; 265–387 `useFrame` with Vogel occlusion + horizon fade + storm gate. |
| Cloud group reference | `src/weather-scene/SceneRefsContext.tsx` | `cloudGroupRef`. Phase-3 deprecates it and adds `cloudDensityTargetRef` + `cloudShadowMapRef`. |
| Sun direction (Part 1) | `src/weather-scene/effects/volumetricClouds/sunDirection.ts` | Phase-2 utility; Phase 3 consumes it unchanged. |

---

## 17. Target approach — `@react-three/postprocessing` `LensFlare` + `three-good-godrays`

### Dependencies to add (beyond Part 1)

Pin exact versions at install time:

```bash
npm install three-good-godrays
# @react-three/postprocessing is already installed in Part 1; confirm it exports `LensFlare`.
```

### Composer chain (final order inside the Part-1 `EffectComposer`)

```tsx
<Atmosphere>
  <EffectComposer enableNormalPass>
    <Clouds {...cloudsProps} />
    <AerialPerspective sky sunLight skyLight />
    <GodRays
      sunPosition={sunWorldPosRef.current}
      samples={godRaySamples}          // preset-driven, see §23
      density={0.96}
      decay={0.93}
      weight={0.4}
      exposure={0.6}
      opacity={godRayAttenuation}      // cloud-density-driven, see §18
    />
    <LensFlare
      position={sunWorldPosRef.current}
      opacity={sunFlareAttenuation}    // cloud-density-driven, see §18
      colorGain={sunColorRef.current}  // warm → white overcast lerp
      glareSize={sunGlareSize}
      flareSize={sunFlareSize}
      starPoints={6}
      flareSpeed={0.4}
      animated
      followMouse={false}
    />
    <LensFlare
      position={moonWorldPosRef.current}
      opacity={moonFlareAttenuation}
      colorGain={new Color(0.75, 0.85, 1.0)}
      glareSize={sunGlareSize * 0.4}
      flareSize={sunFlareSize * 0.4}
      starPoints={0}
      anamorphic={0}
      followMouse={false}
    />
  </EffectComposer>
</Atmosphere>
```

Verify the exact `LensFlare` prop names against the docs at impl time — pre-1.0 drift is possible. Where a prop is missing (e.g. `opacity`), wrap the effect in a thin JSX component that scales its internal uniforms.

---

## 18. Cloud-density occlusion pipeline (the centrepiece)

This is what makes the flare "calculated with clouds overlay." Do it in this order.

### 18.1 Expose the cloud density target

In the Part-1 `VolumetricClouds.tsx`, capture the library's intermediate density `WebGLRenderTarget`. The `@takram/three-clouds` pre-1.0 API surface may name this output differently (`CloudsEffect.densityTexture`, or an entry on `outputs`); verify at impl time and pin the accessor in a single helper:

```ts
// src/weather-scene/effects/lensFlare/getCloudTargets.ts
export function getCloudDensityTarget(effect: unknown): THREE.WebGLRenderTarget | null {
  try {
    // TODO(impl): pin the real accessor name once verified against installed version.
    return (effect as any)?.densityRenderTarget ?? null;
  } catch { return null; }
}
export function getCloudShadowMap(effect: unknown): THREE.Texture | null {
  try {
    return (effect as any)?.shadowMap ?? null;
  } catch { return null; }
}
```

Publish both on `SceneRefsContext`:

```ts
export interface SceneRefsContextValue {
  cloudDensityTargetRef: RefObject<THREE.WebGLRenderTarget | null>;
  cloudShadowMapRef: RefObject<THREE.Texture | null>;
  sunDirectionRef: RefObject<THREE.Vector3>;      // from Part 1 §10
  sunWorldPosRef: RefObject<THREE.Vector3>;       // new — world-space sun for LensFlare.position
  moonWorldPosRef: RefObject<THREE.Vector3>;      // new
}
```

### 18.2 Project the sun to render-target pixel coords

In a `useFrame` throttled by preset (§23), every N frames:

```ts
const target = cloudDensityTargetRef.current;
if (!target) return;

_sunNDC.copy(sunWorldPosRef.current).project(camera);
if (Math.abs(_sunNDC.x) > 1 || Math.abs(_sunNDC.y) > 1 || _sunNDC.z > 1) {
  // Off-screen — skip readback; hold previous opacity or decay to 0.
  return;
}
const px = Math.round((_sunNDC.x * 0.5 + 0.5) * target.width);
const py = Math.round((-_sunNDC.y * 0.5 + 0.5) * target.height);
```

### 18.3 Sample a Vogel disc around the projection

Reuse the existing 8-point Vogel pattern. Move it out of `CelestialBodies.tsx` into:

```ts
// src/weather-scene/effects/lensFlare/flareOcclusion.ts
export const DISC_SAMPLES: readonly [number, number][] = /* existing 8-point Vogel */ [];

export function readCloudDensityAtScreenPos(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  px: number,
  py: number,
  radiusPx: number,
  outBuffer: Uint8Array,                // reused; length 2*radius * 2*radius * 4
): number {
  const size = radiusPx * 2;
  const x = Math.max(0, Math.min(target.width - size, px - radiusPx));
  const y = Math.max(0, Math.min(target.height - size, py - radiusPx));
  renderer.readRenderTargetPixels(target, x, y, size, size, outBuffer);

  let acc = 0;
  for (let i = 0; i < DISC_SAMPLES.length; i++) {
    const [sx, sy] = DISC_SAMPLES[i];
    const ix = Math.round(radiusPx + sx * radiusPx);
    const iy = Math.round(radiusPx + sy * radiusPx);
    const idx = (iy * size + ix) * 4;
    acc += outBuffer[idx] / 255;        // R = density in most libraries; verify channel at impl time.
  }
  return acc / DISC_SAMPLES.length;     // 0 = clear, 1 = fully occluded.
}
```

`radiusPx` should match the apparent angular size of the sun at current FOV (~30 px at `fov=75` at 1080p desktop). Tune during verification.

### 18.4 Throttle, smooth, and compose factors

```ts
const frameRef = useRef(0);
const rawOccRef = useRef(0);
const occRef = useRef(0);

useFrame((state, delta) => {
  frameRef.current++;
  const readEvery = presetFlareReadEvery;         // 3 / 6 / 10 per preset
  if (
    frameRef.current % readEvery === 0 &&
    document.hasFocus()                            // skip in backgrounded tabs
  ) {
    rawOccRef.current = readCloudDensityAtScreenPos(
      state.gl, cloudDensityTargetRef.current!, px, py, sunRadiusPx, pixelBuffer,
    );
  }
  const smooth = 1 - Math.exp(-FLARE_LERP_SPEED * delta);
  occRef.current += (rawOccRef.current - occRef.current) * smooth;

  const elevation = (sunY - SUN_Y_MIN) / (SUN_Y_MAX - SUN_Y_MIN);
  const horizon = smoothstep(0, FLARE_HORIZON_FADE, elevation);
  const storm = config.thunderstorm ? 0 : 1;
  const day = config.timeOfDay === "night" ? 0 : 1;

  sunFlareAttenuationRef.current = (1 - occRef.current) * horizon * storm * day;
  godRayAttenuationRef.current = sunFlareAttenuationRef.current;  // Same gate for both.
});
```

Constants stay at Part-1 values: `FLARE_LERP_SPEED = 3.0`, `FLARE_HORIZON_FADE = 0.25`, `SUN_Y_MIN = 18`, `SUN_Y_MAX = 28`.

### 18.5 The GPU-only path (future optimisation, not for ship)

`readRenderTargetPixels` forces a GPU→CPU sync. Throttled to every 3–10 frames it's ≤ 0.3 % of frame budget, but spikes on tab refocus. The clean fix is a 1×1 compute pass that writes attenuation to a tiny texture consumed as a uniform by `LensFlare`. This requires wrapping `LensFlare` in a custom `Effect` subclass — deferred to a follow-up. Document the seam in `flareOcclusion.ts` so a future engineer can swap implementations without touching call sites.

---

## 19. Sunlight model — delete the decorative `PointLight`

Part 1 §4 adopts `<Atmosphere sunLight skyLight>` — a physically-based directional sun already illuminates the scene. The Three.js `PointLight` in `CelestialBodies.tsx` is:

- **Redundant** — atmosphere now owns actual illumination.
- **Decorative only** — no current material actually responds to it (`MeshBasicMaterial` is unlit).
- **Misleading** — future engineers will assume it matters.

### Action

- Delete the `sunLight = new THREE.PointLight(...)` creation and all references inside `useCelestialLights`.
- Delete `useCelestialLights` itself once the flare migrates out.
- Keep the sun **sphere** (`SphereGeometry(9, 32, 32)` + additive orange `MeshBasicMaterial`) — it's a purely decorative billboard sitting over the atmosphere's sky. Its position is driven by the unified `sunWorldPosRef`.
- Keep the moon sphere unchanged. Moon light (a `THREE.PointLight`, intensity 0.15, color `0xaaccff`) can also be deleted for the same reason — nothing responds to it.

Single source of truth: `sunDirectionRef` (Part 1) and `sunWorldPosRef` (new) drive the atmosphere, the sun sprite, the sun flare, and the god rays. Nothing else computes sun angle.

---

## 20. Moon flare parity (softer, cooler)

A second `LensFlare` pass tuned for night legibility:

- **`colorGain`** — `new Color(0.75, 0.85, 1.0)` (cool blue-white, echoes the moon's sprite tint `0xf8f8ff` × atmosphere's night ambience).
- **`glareSize` and `flareSize`** — ~40 % of sun values. Moon is small and should feel close, not spectacular.
- **`starPoints`** — `0`. No aperture starburst; moon flare is a halo, not an aperture artifact.
- **`anamorphic`** — `0`. Cinematic anamorphic streak belongs to the sun, not the moon.
- **`opacity`** — driven by the same `readCloudDensityAtScreenPos` pipeline (§18), but sampled at the moon's projected position (`moonWorldPosRef`).
- **Day/night gate** — `moonFlareAttenuation *= (timeOfDay === "day" ? 0 : 1)`. Symmetrical to the sun's night gate.
- **Horizon fade** — the moon sits at `MOON.y = 24` fixed today; attenuation is effectively constant, but keep the `smoothstep(0, FLARE_HORIZON_FADE, moonElevation)` factor in place so a future animated moon arc Just Works.

Budget: adds one postprocessing pass at the same shader cost as the sun's flare. Preset ladder (§23) gates this off at `"low"`.

---

## 21. Fade, colour, night/storm behaviour

Preserve today's behaviour exactly — only the data source changes.

- **Night** — `timeOfDay === "night"` multiplies sun flare/godrays by 0.
- **Day** — `timeOfDay === "day"` multiplies moon flare by 0.
- **Overcast colour shift** — same lerp as today: `sunColor = WARM.lerp(WHITE, smoothstep(0.3, 0.8, cloudCover))`, piped into `LensFlare.colorGain` via `sunColorRef`.
- **Storm gate** — `thunderstorm ? 0 : 1` multiplier applied to sun flare + godrays.
- **Lightning flash coupling** — subscribe to the same flash-event ref `LightningEffect` publishes (Part 1 §9). On flash, pulse `sunFlareAttenuation *= 1.35` for 80 ms, then decay. Simulates the sun momentarily "showing through" as lightning briefly backlights the cloud column. Skip the pulse if `occRef.current < 0.5` (sun already visible — no pulse needed).

---

## 22. God rays / light shafts

`three-good-godrays` slots into the composer immediately after `AerialPerspective` and before `LensFlare`.

- **Light source position.** Pass `sunWorldPosRef.current` (the same vector feeding the atmosphere and flare). The library projects it internally.
- **Occluder source (the key bit).** Feed the Beer Shadow Map output from `@takram/three-clouds` via `cloudShadowMapRef`. When the sun is behind a cloud column, BSM marks those rays as shadowed, and godrays raymarches those shadows into visible crepuscular beams. If the library's godrays pass doesn't accept an arbitrary occluder texture directly, write a thin wrapper effect that binds the BSM to the raymarch shader's sampler — single-file shim.
- **Tuning defaults (adjust during verification):** `density=0.96`, `decay=0.93`, `weight=0.4`, `exposure=0.6`, `samples` per-preset (§23).
- **Attenuation.** Same `sunFlareAttenuation` factor. When the sun is fully behind clouds, beams fade too (otherwise you get "beams from nowhere").
- **Gates.**
  - Disabled entirely at `"low"` preset.
  - Disabled at `timeOfDay === "night"`.
  - Horizon fade applied identically to the sun flare.
  - Skipped when `sunNDC` is off-screen (avoids edge artifacts when sun goes past the frame).

---

## 23. Mobile / perf preset impact

Extend the Part-1 preset ladder (§8) with flare/godray knobs. **Cross-reference §8; do not duplicate that table.**

| Preset | Flare readback cadence | GodRays samples | GodRays enabled | Moon flare |
|---|---|---|---|---|
| `low` | every 10 frames | — | **off** | **off** |
| `medium` | every 6 frames | 40 | on | on (40 % size) |
| `high` | every 3 frames | 80 | on | on |
| `ultra` | every 2 frames | 128 | on | on |

Gate reads: preset is supplied by the same `detectCloudsPreset()` helper from Part 1 §8. Wire the godray samples and moon-flare enable into JSX via the same `useMemo` that builds cloud props.

---

## 24. Files to modify / add / delete (Part 2)

### Add

- `src/weather-scene/effects/LensFlareAndGodRays.tsx` — one component that mounts `<GodRays>`, the sun `<LensFlare>`, and the moon `<LensFlare>` inside the Part-1 `EffectComposer`. It is legitimate to merge this into `VolumetricClouds.tsx` if the composer footprint stays small.
- `src/weather-scene/effects/lensFlare/flareOcclusion.ts` — `DISC_SAMPLES` (moved from `CelestialBodies.tsx`), `readCloudDensityAtScreenPos(...)` helper, buffer pool.
- `src/weather-scene/effects/lensFlare/flareProps.ts` — `SimulationConfig` → `LensFlare` / `GodRays` runtime props (colour, sizes, samples).
- `src/weather-scene/effects/lensFlare/getCloudTargets.ts` — defensive accessor for the library's internal render targets.

### Modify

- `src/weather-scene/effects/CelestialBodies.tsx`
  - Delete imports `Lensflare`, `LensflareElement` from `three/examples/jsm/objects/Lensflare.js`.
  - Delete `useCelestialLights` hook (sun + moon `PointLight` + `Lensflare` creation).
  - Delete `createRadialGradientTexture` helper and `LENS_FLARE_ELEMENTS` constant block.
  - Delete the Vogel occlusion block inside the existing `useFrame` (lines 302–354 today).
  - Keep the sun and moon sphere meshes; keep the overcast colour lerp on the sun sphere material; keep `computeCelestialState` if useful for sprite positioning (otherwise replace with direct `sunWorldPosRef` read).
- `src/weather-scene/SceneRefsContext.tsx`
  - Add `cloudDensityTargetRef`, `cloudShadowMapRef`, `sunWorldPosRef`, `moonWorldPosRef`.
  - Remove `cloudGroupRef` (Part 1 already deprecated it; Part 2 finishes the removal once the Vogel raycast is gone).
- `src/weather-scene/effects/VolumetricClouds.tsx` (from Part 1)
  - Publish the library's density target + shadow map on the new refs via `useEffect`.
- `src/weather-scene/WeatherScene.tsx`
  - Mount `<LensFlareAndGodRays>` inside the composer after `<AerialPerspective>`.
- `package.json` — add `three-good-godrays` pinned (`=`, not `^`).

### Delete

- `createRadialGradientTexture` helper and `LENS_FLARE_ELEMENTS` array (inside `CelestialBodies.tsx`).
- All references to `three/examples/jsm/objects/Lensflare.js` in the repo.

---

## 25. Risks & rollback (Part 2)

### Risks

- **`readRenderTargetPixels` GPU→CPU sync.** ~1 ms per call. Throttled to 3–10 frames per preset it's ≤ 0.3 % frame budget, but can spike on tab refocus. Mitigations: skip when `!document.hasFocus()`; pool the `Uint8Array` buffer (no per-frame allocations); early-exit when `sunNDC` is off-screen. Future-proof exit: GPU-only attenuation (§18.5).
- **Library internals fragility.** `@takram/three-clouds` is pre-1.0; the density/BSM accessors may rename in a minor bump. Pin exact versions (`=`, not `^`). Localise the brittle access in `getCloudTargets.ts` — if a lib update breaks it, one file fails loudly instead of three.
- **`LensFlare` internal occlusion vs ours.** The effect may default to depth-buffer occlusion. Our clouds don't write to scene depth (they're a post-pass), so the internal path would always read "visible." Our manual `opacity` pipeline overrides this correctly, but confirm at impl time by reading the effect source — disable its internal occlusion sampler if it competes with our input.
- **Godrays horizon clipping.** Some godray implementations produce edge-of-frame artifacts when the sun is near the frame boundary. Mitigations: horizon-fade the godray pass on `smoothstep(0, FLARE_HORIZON_FADE, elevation)`; skip godrays when `sunNDC` is out of `[-1, 1]`.
- **Bundle cost.** `three-good-godrays` is ~60 KB gz. Sits inside the ~380 KB Part-1 budget.
- **Perceptual brittleness.** Flare occlusion feels correct only when the density buffer actually represents what the viewer sees. If the Part-1 `Clouds` pass uses temporal upscale, the density buffer can lag by 1 frame — smoothing with the existing exponential (0.33 s) hides this.

### Rollback

- Part 2 adds files and surgically deletes from `CelestialBodies.tsx`. A single `git revert <phase-3-commit>` restores the Three.js `Lensflare` code. Keep the Phase-3 work in one commit so rollback is clean.
- If the density-buffer read proves too expensive on a specific device class, fall back *per preset* to a `cloudCover`-only heuristic (set `rawOccRef = config.cloudCover`) instead of reverting the whole refactor.

---

## 26. Verification checklist (Part 2)

Hand-run before merge:

- [ ] `npm install three-good-godrays` succeeds with no peer-dep warnings.
- [ ] `npm start` launches without WebGL warnings; GPU memory stable at idle.
- [ ] **Flare occlusion accuracy.** Slowly sweep `cloudCover` from 0 → 1 via `DebugMenu`: flare dims smoothly, not in steps.
- [ ] **Spatial occlusion.** At `cloudCover = 0.4`, camera parallax confirms flare dims only when a cloud actually passes in front of the sun on screen (not when clouds appear elsewhere in sky).
- [ ] **Godrays through gaps.** At `cloudCover = 0.3 – 0.6`, beams are visible streaming through cloud gaps (crepuscular-ray effect).
- [ ] **Full overcast.** `cloudCover = 1.0`: flare and godrays are both fully hidden.
- [ ] **Horizon fade.** Move `dt` near sunrise/sunset: flare + godrays fade smoothly; no pop at frame edges.
- [ ] **Storm.** Thunderstorm effect: flare + godrays off; each lightning flash briefly pulses flare opacity by ~35 % for < 100 ms.
- [ ] **Moon flare.** At night, moon flare is visible with cool blue-white tint at ~40 % the sun's size; no starburst; no anamorphic streaks.
- [ ] **Moon occlusion.** Clouds passing in front of the moon dim the moon flare — same pipeline, different position.
- [ ] **Day/night gates.** Sun flare hidden at `timeOfDay === "night"`; moon flare hidden at `timeOfDay === "day"`.
- [ ] **`"low"` preset.** Godrays disabled, moon flare disabled, flare readback throttled to every 10 frames. ≥ 30 fps on mid-tier mobile.
- [ ] **Tab backgrounded.** Focus another window for 10 s; return: no frame hitch on refocus (readback was skipped while unfocused).
- [ ] **No stale imports.** Search repo for `three/examples/jsm/objects/Lensflare.js` and `LensflareElement` — zero hits.
- [ ] **No dead refs.** Search repo for `cloudGroupRef` — zero hits.
- [ ] **Bundle delta recorded** (before vs after Part 2 only).

---

## 27. Implementation sequencing (Part 2)

Runs strictly after Part 1 step 11. Eight commit-sized steps.

12. **Expose cloud targets.** Install `three-good-godrays`. In `VolumetricClouds.tsx`, capture the density + BSM render targets and publish them via new `SceneRefsContext` refs. Add a dev-only debug overlay that blits the density target into a screen corner so the implementer can see what the flare is sampling.
13. **Prototype `LensFlare`.** Mount `<LensFlare>` inside the composer at the sun's world position with hardcoded `opacity={1}`. Visually compare against the old Three.js flare rendering in parallel (keep both mounted temporarily).
14. **Occlusion pipeline.** Write `flareOcclusion.ts` with `DISC_SAMPLES` and `readCloudDensityAtScreenPos`. Wire `sunFlareAttenuation` through the projection → readback → smoothing pipeline (§18). Verify dimming by moving clouds under debug control.
15. **God rays.** Add `<GodRays>` with the BSM as occluder (via the wrapper if needed). Tune `density`/`decay`/`weight`/`samples` at desktop `high` preset across all 5 cover buckets.
16. **Moon flare.** Add the second `<LensFlare>` pass for the moon with cool palette and reduced sizes. Mirror the occlusion pipeline at `moonWorldPosRef`.
17. **Preset gating.** Extend `detectCloudsPreset` / `qualityPreset.ts` outputs to include `flareReadEvery`, `godRaySamples`, `godRaysEnabled`, `moonFlareEnabled`. Wire into JSX.
18. **Delete the old path.** Remove `Lensflare`/`LensflareElement` imports, `useCelestialLights`, `LENS_FLARE_ELEMENTS`, `createRadialGradientTexture`, the Vogel raycast block in `useFrame`, and the sun/moon `PointLight`s from `CelestialBodies.tsx`. Remove `cloudGroupRef` from `SceneRefsContext`.
19. **Verification pass.** Run the full §26 checklist. Record bundle delta. Close out Part 2.

Target: 3–4 days of focused work after Part 1 lands.
