import React, { Component } from "react";
import type { ReactNode } from "react";
import type { SceneParams } from "../weather/sceneParams";
import {
  WeatherScene as Scene3D,
  type WeatherSceneViewProps,
} from "./WeatherScene";

/** Renders nothing on a scene error (the UI works without it); the error goes to the console. */
class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Weather scene crashed:", error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface WeatherSceneContainerProps extends WeatherSceneViewProps {
  params: SceneParams;
}

export const WeatherSceneContainer: React.FC<WeatherSceneContainerProps> = ({
  params,
  ...view
}) => {
  return (
    <div className="weather-scene-container" aria-hidden="true">
      <SceneErrorBoundary>
        <Scene3D params={params} {...view} />
      </SceneErrorBoundary>
    </div>
  );
};
