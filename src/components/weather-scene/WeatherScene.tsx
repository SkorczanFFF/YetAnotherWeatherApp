import React, { useMemo } from "react";
import { WeatherData } from "../../types/weather";
import type { DebugOverrides } from "../../weather/config";
import { mapToSimulationConfig } from "../../weather/config";
import { WeatherScene as Scene3D } from "../../weather-scene";
import type { DebugBoxPosition } from "../../weather-scene";

interface WeatherSceneContainerProps {
  weather: WeatherData | null;
  overrides?: DebugOverrides | null;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
}

const WeatherSceneContainer: React.FC<WeatherSceneContainerProps> = ({
  weather,
  overrides,
  showDebugBox,
  debugBoxPosition,
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
