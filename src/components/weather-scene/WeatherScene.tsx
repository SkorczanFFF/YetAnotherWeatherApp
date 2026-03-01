import React, { useMemo } from "react";
import { WeatherData } from "../../types/weather";
import type { DebugOverrides } from "../../weather/config";
import { mapToSimulationConfig } from "../../weather/config";
import { WeatherScene as Scene3D, type DebugBoxPosition } from "../../weather-scene/WeatherScene";
import type { CloudSpawnBounds } from "../../weather-scene/scene/CloudSpawnDebugBox";

interface WeatherSceneContainerProps {
  weather: WeatherData | null;
  overrides?: DebugOverrides | null;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
  onCloudSpawnBoundsChange?: (bounds: CloudSpawnBounds) => void;
}

const WeatherSceneContainer: React.FC<WeatherSceneContainerProps> = ({
  weather,
  overrides,
  showDebugBox,
  debugBoxPosition,
  onCloudSpawnBoundsChange,
}) => {
  const config = useMemo(
    () => mapToSimulationConfig(weather, overrides),
    [weather, overrides],
  );
  const showFrostOverlay =
    typeof config.temperature === "number" && config.temperature < 0;

  return (
    <div className="weather-scene-container" aria-hidden="true">
      <Scene3D
        config={config}
        showDebugBox={showDebugBox}
        debugBoxPosition={debugBoxPosition}
        onCloudSpawnBoundsChange={onCloudSpawnBoundsChange}
      />
      <div
        className="weather-scene-frost"
        style={{
          opacity: showFrostOverlay ? 0.5 : 0,
          pointerEvents: "none",
          backgroundImage: `url(${process.env.PUBLIC_URL || ""}/effects/frost.png)`,
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default WeatherSceneContainer;
