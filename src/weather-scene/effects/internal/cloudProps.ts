import { Vector2, Vector3 } from "three";
import type { SimulationConfig } from "../../types";
import { getCloudTier } from "./cloudTiers";

// windSpeed comes from Open-Meteo as km/h. The three-clouds library adds
// velocity*dt to texture-UV offsets every frame; shape UVs are scaled by
// shapeRepeat=0.0003, so a physical drift of ~5 m/s works out to ~0.0015
// UV/s. These multipliers target near-physical accuracy, with a small
// artistic boost so motion is perceptible: clouds are 60–380 m overhead,
// and at that distance their angular velocity is tiny — pushing much above
// physical speed reads as time-lapse and breaks the "kilometres overhead"
// illusion. `detail` gets slightly more motion than `shape` to give the
// edges a turbulent boil without the whole deck sliding fast.
const KMH_TO_MS = 1 / 3.6;
const WIND_TO_LOCAL_WEATHER = KMH_TO_MS * 0.0002;
const WIND_TO_SHAPE = KMH_TO_MS * 0.0025;
const WIND_TO_DETAIL = KMH_TO_MS * 0.008;
// Never fully freeze — even at wind=0 clouds should breathe slightly so the
// scene doesn't read as a still image.
const MIN_DRIFT = 0.0001;

export interface CloudsRuntimeProps {
  coverage: number;
  densityScale: number;
  localWeatherVelocity: Vector2;
  shapeVelocity: Vector3;
  shapeDetailVelocity: Vector3;
}

export function buildCloudsProps(config: SimulationConfig): CloudsRuntimeProps {
  const rad = ((config.windDirection ?? 0) * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirZ = -Math.cos(rad);
  const speed = config.windSpeed ?? 0;

  let wLocX = dirX * speed * WIND_TO_LOCAL_WEATHER;
  let wLocZ = dirZ * speed * WIND_TO_LOCAL_WEATHER;
  if (Math.abs(wLocX) < MIN_DRIFT && Math.abs(wLocZ) < MIN_DRIFT) {
    wLocX = MIN_DRIFT;
    wLocZ = MIN_DRIFT * 0.3;
  }

  // cloudTiers shapes coverage/density across the full 0..1 cloudCover sweep
  // so we get clear → scattered → mostly cloudy → overcast as anchor states.
  const tier = getCloudTier(config.cloudCover ?? 0);
  const stormBoost = config.thunderstorm ? 1.25 : 1;
  const snowBoost = config.effectType === "snow" ? 1.1 : 1;
  const userOpacity = config.cloudOpacity ?? 1;
  const densityScale = tier.densityScale * stormBoost * snowBoost * userOpacity;

  return {
    coverage: tier.coverage,
    densityScale,
    localWeatherVelocity: new Vector2(wLocX, wLocZ),
    shapeVelocity: new Vector3(
      dirX * speed * WIND_TO_SHAPE,
      0,
      dirZ * speed * WIND_TO_SHAPE,
    ),
    shapeDetailVelocity: new Vector3(
      dirX * speed * WIND_TO_DETAIL,
      0,
      dirZ * speed * WIND_TO_DETAIL,
    ),
  };
}
