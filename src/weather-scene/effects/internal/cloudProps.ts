import { Vector2, Vector3 } from "three";
import type { SimulationConfig } from "../../types";
import { getCloudTier } from "./cloudTiers";

// windSpeed comes from Open-Meteo as km/h. The three-clouds library adds
// velocity*dt to texture-UV offsets every frame; shape UVs are scaled by
// shapeRepeat=0.0003, so a physical drift of ~5 m/s works out to ~0.0015
// UV/s. These multipliers target near-physical accuracy with a small
// artistic boost so motion is perceptible.
const KMH_TO_MS = 1 / 3.6;
const WIND_TO_LOCAL_WEATHER = KMH_TO_MS * 0.0002;
const WIND_TO_SHAPE = KMH_TO_MS * 0.0025;
const WIND_TO_DETAIL = KMH_TO_MS * 0.008;
// Never fully freeze — even at wind=0 clouds should breathe slightly so the
// scene doesn't read as a still image.
const MIN_DRIFT = 0.0001;

export interface CloudsRuntimeProps {
  coverage: number;
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

  // cloudTiers shapes coverage across the full 0..1 cloudCover sweep so we
  // get clear → scattered → mostly cloudy → overcast as anchor states.
  const tier = getCloudTier(config.cloudCover ?? 0);

  return {
    coverage: tier.coverage,
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
