import React, { Component } from "react";
import type { ReactNode } from "react";
import type { SceneParams } from "../weather/sceneParams";
import {
  WeatherScene as Scene3D,
  type WeatherSceneDebugProps,
} from "./WeatherScene";

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
  params: SceneParams;
}

export const WeatherSceneContainer: React.FC<WeatherSceneContainerProps> = ({
  params,
  ...debug
}) => {
  return (
    <div className="weather-scene-container" aria-hidden="true">
      <SceneErrorBoundary>
        <Scene3D params={params} {...debug} />
      </SceneErrorBoundary>
    </div>
  );
};
