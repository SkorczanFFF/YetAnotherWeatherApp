# Weather Simulation Engine — Implementation Plan

## 1. Current State Analysis

### 1.1 Architecture Overview

```
WeatherData (API) → weatherSceneLogic → weatherPhysics → WeatherScene (single useEffect)
```

All effects (rain, snow, clouds, mist, fog, thunderstorm) live in one `WeatherScene` component with a single `useEffect` and animation loop. Config is derived from `weather_code`, `wind_speed`, `wind_direction`, `dt`, `sunrise`, `sunset`.

### 1.2 Known Issues

| Issue | Root Cause | Impact |
|-------|------------|--------|
| **Snow not visible** | (a) White snow (#ffffff) on light blue day sky (#87ceeb) — no contrast. (b) Snow may use world-space size (0.12) with `sizeAttenuation` — tiny at distance. (c) Spawn zone too narrow (x: ±3) — particles concentrate and blow out of view quickly. | Snow effect appears to not render |
| **Clouds flickering** | (a) X and Z boundary checks run in same frame — cloud can be teleported twice (e.g. x>32 sets pos, then z>20 overwrites pos). (b) Recycle threshold may be within visible frustum. (c) Spawn position can land partly in view. (d) No single-teleport-per-frame guarantee. | Visible pop when clouds recycle |
| **Particles vanish** | Spawn zone and camera frustum misaligned — particles drift out of view. Respawn logic may trigger before particles fully leave, or respawn puts them off-screen. | Intermittent visibility |

### 1.3 Weather API Data (Open-Meteo)

**Current:** `weather_code`, `wind_speed_10m`, `wind_direction_10m`, `is_day`, `sunrise`, `sunset`, `dt`, `timezone`.

**Available but unused:** `visibility`, `precipitation`, `cloud_cover` (hourly), `relative_humidity_2m`, `pressure_msl`.

**Weather code → condition mapping (WMO):**
- 0–3: Clear / mainly clear / partly cloudy / overcast
- 45, 48: Fog
- 51–57: Drizzle (light / moderate / dense)
- 61–67: Rain
- 71–77: Snow
- 80–82: Rain showers
- 85–86: Snow showers
- 95–99: Thunderstorm

---

## 2. Design Principles

1. **Camera-relative spawn volume** — All particles spawn in a volume that matches the visible frustum. Camera at z=5, FOV 75° → define spawn bounds from frustum planes.
2. **Single recycle per entity per frame** — Clouds and particles must perform at most one teleport per frame to avoid flicker.
3. **Modular effect system** — Each effect (rain, snow, fog, clouds, thunderstorm) is a separate module with `init()`, `update(dt, config)`, `dispose()`.
4. **Physics-driven** — Wind direction and speed drive drift; intensity drives density and fall speed. No magic numbers without a named constant.

---

## 3. Proposed Architecture

### 3.1 Module Structure

```
src/
├── weather-simulation/
│   ├── WeatherSimulationEngine.ts    # Orchestrator: creates scene, manages effects
│   ├── types.ts                      # SimulationConfig, Effect interfaces
│   ├── cameraFrustum.ts              # Visible bounds from camera + FOV
│   ├── effects/
│   │   ├── RainEffect.ts
│   │   ├── SnowEffect.ts
│   │   ├── FogEffect.ts
│   │   ├── CloudEffect.ts
│   │   ├── MistEffect.ts
│   │   └── ThunderstormEffect.ts
│   └── physics/
│       ├── weatherPhysics.ts        # Constants (existing)
│       └── configMapper.ts           # WeatherData → SimulationConfig
```

### 3.2 SimulationConfig

```ts
interface SimulationConfig {
  effectType: 'clear' | 'rain' | 'snow' | 'fog' | 'thunderstorm';
  intensity: 'light' | 'moderate' | 'heavy';
  windSpeed: number;      // km/h
  windDirection: number;  // degrees
  cloudCover: number;     // 0–1
  fogDensity: number;     // 0 or positive
  thunderstorm: boolean;
  timeOfDay: 'night' | 'dawn' | 'day' | 'dusk';
}
```

### 3.3 Effect Interface

```ts
interface WeatherEffect {
  init(scene: THREE.Scene, config: SimulationConfig): void;
  update(dt: number, config: SimulationConfig, bounds: FrustumBounds): void;
  dispose(): void;
}
```

### 3.4 FrustumBounds

Compute from camera position, FOV, aspect ratio, near/far:

```ts
interface FrustumBounds {
  spawnYMin: number; spawnYMax: number;  // Top of visible volume
  spawnXMin: number; spawnXMax: number;
  spawnZMin: number; spawnZMax: number;  // In front of camera
  recycleY: number;   // Below this → respawn
  recycleXMin: number; recycleXMax: number;
  recycleZMin: number; recycleZMax: number;
}
```

---

## 4. Effect Specifications

### 4.1 Rain

- **Spawn:** Single plane at top of frustum (y = spawnYMax), small random offset in x/z.
- **Physics:** Gravity (fall), wind (drift). Rain falls fast, wind deflects strongly.
- **Recycle:** When y < recycleY OR x/z outside bounds → respawn at spawn plane.
- **Material:** Points, `sizeAttenuation: false`, dark blue-gray (#1e3a5f), pixel size.
- **One respawn per particle per frame.**

### 4.2 Snow

- **Spawn:** Same plane as rain.
- **Physics:** Slower fall, less wind deflection.
- **Recycle:** Same logic as rain.
- **Material:** Points, `sizeAttenuation: false`. **Color:** Slight gray (#e8eef4) or soft shadow so visible on light sky. Optional: thin dark outline via small `size` and darker color, or `depthTest: false` + render after sky.
- **One respawn per particle per frame.**

### 4.3 Fog

- **Implementation:** THREE.FogExp2 with neutral gray color. Density from config.
- **Optional:** Add 1–2 large, very low-opacity planes drifting slowly for “mist layer” depth.
- **No particles** — scene-level fog only. Mist planes recycle like clouds if used.

### 4.4 Clouds

- **Spawn:** Off-screen on upwind side. Wind direction → spawn on opposite side of drift.
- **Recycle:** Only when **fully** off-screen. Use `else if` chain: at most one teleport per cloud per frame.
- **Bounds:** Recycle at x > 45 or x < -45 (or similar); spawn at opposite side ± 10 random offset.
- **Avoid double-teleport:** `if (x out) { respawn; return } else if (z out) { respawn }`.
- **Optional:** Fade opacity near edges to soften pop (not required for first version).

### 4.5 Mist (Fog Planes)

- **Spawn:** Single point near ground (y ≈ 2, z ≈ -2), small x/z spread.
- **Physics:** Slow drift with wind.
- **Recycle:** When outside bounds → respawn at spawn point.
- **Material:** Low-opacity planes, `depthWrite: false`.

### 4.6 Thunderstorm

- **Composition:** Rain effect + darker sky + lightning flash overlay.
- **Lightning:** CSS/HTML overlay, flash every 2–5 s. No geometry.
- **Rain:** Use rain effect with higher intensity and wind multiplier.

---

## 5. Camera Frustum Bounds

```ts
// Camera at (0, 0, 5), lookAt (0, 0, 0), FOV 75°
// Visible region in front: approximate box
const VISIBLE = {
  x: [-10, 10],   // at z=0
  y: [-8, 8],
  z: [-15, 4],    // 4 = before camera plane
};
// Spawn at top: y = 10–12, x in [-4, 4], z in [-6, 2]
// Recycle when: y < -10, or x outside [-14, 14], or z outside [-12, 4]
```

Derive these from `camera.position`, `camera.fov`, aspect ratio, and `lookAt` target.

---

## 6. Implementation Order

1. **Phase 1 — Fix current bugs**
   - Fix snow: color + `sizeAttenuation: false` + visible spawn zone.
   - Fix clouds: single-teleport-per-frame (`else if`), larger recycle bounds.
   - Verify particle spawn/respawn stays inside visible volume.

2. **Phase 2 — Extract `cameraFrustum.ts`**
   - Compute spawn and recycle bounds from camera.
   - Use in particle and cloud recycle logic.

3. **Phase 3 — Extract effect modules**
   - `RainEffect`, `SnowEffect` as classes with `update()`.
   - Move cloud logic into `CloudEffect`.
   - Keep single animation loop, call each effect’s `update()`.

4. **Phase 4 — Fog and mist**
   - Refine fog density and mist plane recycling.
   - Ensure fog visible at night (neutral color).

5. **Phase 5 — Optional enhancements**
   - API: add `visibility`, `precipitation` if needed.
   - Drizzle as lighter/slower rain.
   - Cloud opacity fade at edges.

---

## 7. Snow Visibility Fix (Immediate)

1. **Color:** Use `0xdde5ed` or `0xe0e8f0` instead of `0xffffff` for better contrast on light sky.
2. **Size:** Ensure `sizeAttenuation: false` and pixel-based size (e.g. `2.5 * pixelRatio`).
3. **Spawn area:** Widen spawn x to ±6 or ±8 so particles spread more before wind blows them away.
4. **Render order:** Optional — render snow/rain after sky by using `renderOrder` or a separate pass.

---

## 8. Cloud Flicker Fix (Immediate)

1. **Single teleport per frame:**
```ts
if (cloud.position.x > 40) {
  cloud.position.set(-40 - rnd*8, ...);
} else if (cloud.position.x < -40) {
  cloud.position.set(40 + rnd*8, ...);
} else if (cloud.position.z > 25) {
  cloud.position.set(..., -25 - rnd*8);
} else if (cloud.position.z < -25) {
  cloud.position.set(..., 25 + rnd*8);
}
```
2. **Bounds:** Use 40/25 (or larger) so clouds are fully off-screen before recycle.
3. **Spawn offset:** Add ±8 random so recycled clouds don’t appear exactly on the edge.

---

## 9. Data Flow Summary

```
Open-Meteo API
    ↓
WeatherData { weather_code, speed, wind_direction, ... }
    ↓
configMapper: WeatherData → SimulationConfig
    ↓
WeatherSimulationEngine (or WeatherScene)
    ↓
FrustumBounds (from camera)
    ↓
Each effect: update(dt, config, bounds)
    - Apply wind, gravity
    - Recycle out-of-bounds → respawn at spawn volume
```

---

## 10. Testing Checklist

- [ ] Snow visible on day (light blue sky)
- [ ] Snow visible on night (dark sky)
- [ ] Rain visible on day and night
- [ ] Clouds drift smoothly without visible pop
- [ ] Fog visible at night
- [ ] Thunderstorm: flash + rain + dark sky
- [ ] Wind affects rain, snow, clouds, mist
- [ ] Debug menu (F7) overrides work
- [ ] Weather change transitions smoothly
