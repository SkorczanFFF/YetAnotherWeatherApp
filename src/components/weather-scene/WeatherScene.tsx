import React, { useEffect, useState, useMemo } from "react";
import { WeatherData } from "../../types/weather";
import type { DebugOverrides } from "./types";
import { mapToSimulationConfig } from "../../weather/config";
import { WeatherSceneR3F } from "../../weather-scene/WeatherSceneR3F";

interface WeatherSceneProps {
  weather: WeatherData | null;
  overrides?: DebugOverrides | null;
}

const WeatherScene: React.FC<WeatherSceneProps> = ({ weather, overrides }) => {
  const config = useMemo(
    () => mapToSimulationConfig(weather, overrides),
    [weather, overrides],
  );
  const [flashOpacity, setFlashOpacity] = useState(0);
  const showFrostOverlay =
    typeof config.temperature === "number" && config.temperature < 0;

  useEffect(() => {
    if (!config.thunderstorm) return;
    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const delay = 2000 + Math.random() * 3000;
      return setTimeout(() => {
        setFlashOpacity(0.55);
        setTimeout(() => setFlashOpacity(0), 150);
        timeoutRef.current = scheduleNext();
      }, delay);
    };
    const timeoutRef = { current: scheduleNext() };
    return () => clearTimeout(timeoutRef.current);
  }, [weather, overrides, config.thunderstorm]);

  return (
    <div className="weather-scene-container" aria-hidden="true">
      <WeatherSceneR3F config={config} />
      <div
        className="weather-scene-flash"
        style={{
          opacity: flashOpacity,
          pointerEvents: "none",
        }}
        aria-hidden="true"
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

export default WeatherScene;
