import React, { Component, useMemo } from "react";
import type { ReactNode } from "react";
import type { Units, WeatherData } from "../../weather/types";
import { mapToSceneParams, type SceneOverrides } from "../../weather/sceneParams";
import {
  WeatherScene as Scene3D,
  type WeatherSceneDebugProps,
} from "../../weather-scene/WeatherScene";

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

interface WeatherSceneContainerProps extends WeatherSceneDebugProps {
  weather: WeatherData | null;
  units: Units;
  overrides?: SceneOverrides | null;
}

const WeatherSceneContainer: React.FC<WeatherSceneContainerProps> = ({
  weather,
  units,
  overrides,
  ...debug
}) => {
  const params = useMemo(
    () => mapToSceneParams(weather, units, overrides),
    [weather, units, overrides],
  );
  return (
    <div className="weather-scene-container" aria-hidden="true">
      <SceneErrorBoundary>
        <Scene3D params={params} {...debug} />
      </SceneErrorBoundary>
    </div>
  );
};

export default WeatherSceneContainer;
