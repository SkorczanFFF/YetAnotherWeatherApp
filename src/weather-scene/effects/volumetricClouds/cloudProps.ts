import { Vector2, Vector3 } from "three";
import type { SimulationConfig } from "../../types";

const WIND_TO_LOCAL_WEATHER = 0.0005;
const WIND_TO_SHAPE = 0.002;
const WIND_TO_DETAIL = 0.01;
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
  }

  const coverage = config.cloudCover ?? 0;
  const stormBoost = config.thunderstorm ? 1.25 : 1;
  const snowBoost = config.effectType === "snow" ? 1.1 : 1;
  const densityScale = (config.cloudOpacity ?? 1) * stormBoost * snowBoost;

  return {
    coverage,
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
