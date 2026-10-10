import React, { Component, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import type { Units, WeatherData } from "../../weather/types";
import {
  getFrostAmount,
  isNightAt,
  mapToSceneParams,
  type SceneOverrides,
} from "../../weather/sceneParams";
import {
  WeatherScene as Scene3D,
  type WeatherSceneDebugProps,
} from "../../weather-scene/WeatherScene";
import { useNow } from "../../weather-scene/core/useNow";

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

/** Max frost overlay opacity (at −15 °C and below). */
const FROST_MAX_OPACITY = 0.7;

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
  const now = useNow(60_000);
  const isNight = isNightAt(params.time ?? now, params.lat, params.lon);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.setProperty(
      "--app-text-color",
      isNight ? "#eaf2f7" : "#000e3d9d",
    );
    document.body.style.setProperty(
      "--app-accent-color",
      isNight ? "#e8846b" : "#ad5841",
    );
    return () => {
      document.body.style.removeProperty("--app-text-color");
      document.body.style.removeProperty("--app-accent-color");
    };
  }, [isNight]);
  const frostOpacity = getFrostAmount(params) * FROST_MAX_OPACITY;

  return (
    <>
      <div className="weather-scene-container" aria-hidden="true">
        <SceneErrorBoundary>
          <Scene3D params={params} {...debug} />
        </SceneErrorBoundary>
      </div>
      <div
        className="weather-scene-frost"
        style={{ opacity: frostOpacity }}
        aria-hidden="true"
      >
        <img className="frost-edge frost-left" src="/effects/frost-left.png" alt="" />
        <img className="frost-edge frost-right" src="/effects/frost-right.png" alt="" />
        <img className="frost-edge frost-top" src="/effects/frost-top.png" alt="" />
        <img className="frost-edge frost-bottom" src="/effects/frost-bottom.png" alt="" />
      </div>
    </>
  );
};

export default WeatherSceneContainer;
