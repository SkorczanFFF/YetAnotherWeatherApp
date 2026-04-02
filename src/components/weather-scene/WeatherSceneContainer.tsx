import React, { Component, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import { WeatherData } from "../../weather/types";
import type { DebugOverrides } from "../../weather/config";
import { mapToSimulationConfig } from "../../weather/config";
import { WeatherScene as Scene3D, type DebugBoxPosition } from "../../weather-scene/WeatherScene";

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface WeatherSceneContainerProps {
  weather: WeatherData | null;
  overrides?: DebugOverrides | null;
  showDebugBox?: boolean;
  debugBoxPosition?: DebugBoxPosition;
  freeCamera?: boolean;
}

const WeatherSceneContainer: React.FC<WeatherSceneContainerProps> = ({
  weather,
  overrides,
  showDebugBox,
  debugBoxPosition,
  freeCamera = false,
}) => {
  const config = useMemo(
    () => mapToSimulationConfig(weather, overrides),
    [weather, overrides],
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isNight = config?.timeOfDay === "night";
    document.body.style.setProperty(
      "--app-text-color",
      isNight ? "#eaf2f7" : "#000e3d9d",
    );
    return () => {
      document.body.style.removeProperty("--app-text-color");
    };
  }, [config?.timeOfDay]);
  const showFrostOverlay =
    typeof config.temperature === "number" && config.temperature < 0;

  return (
    <div className="weather-scene-container" aria-hidden="true">
      <SceneErrorBoundary>
        <Scene3D
          config={config}
          showDebugBox={showDebugBox}
          debugBoxPosition={debugBoxPosition}
          freeCamera={freeCamera}
        />
      </SceneErrorBoundary>
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
