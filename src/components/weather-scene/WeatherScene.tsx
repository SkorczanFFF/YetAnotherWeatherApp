import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { WeatherData } from "../../types/weather";
import {
  getSceneConfigFromWeatherCode,
  getTimeOfDayPhase,
} from "./weatherSceneLogic";
import type { DebugOverrides, ResolvedSceneConfig } from "./types";

const DEFAULT_CONFIG: ResolvedSceneConfig = {
  type: "clear",
  intensity: "light",
  particleCount: 0,
  fogDensity: 0,
  thunderstorm: false,
  cloudCover: 0.4,
  windSpeed: 0,
  windDirection: 0,
  timeOfDay: "day",
  parallaxAmount: 0.15,
};

function resolveConfig(
  weather: WeatherData | null,
  overrides: DebugOverrides | null | undefined
): ResolvedSceneConfig {
  const base = weather
    ? (() => {
        const c = getSceneConfigFromWeatherCode(weather.weather_code);
        const phase = getTimeOfDayPhase(
          weather.dt,
          weather.sunrise,
          weather.sunset
        );
        return {
          ...c,
          windSpeed: weather.speed ?? 0,
          windDirection: weather.wind_direction ?? 0,
          timeOfDay: phase,
          parallaxAmount: 0.15,
          thunderstorm: c.thunderstorm,
        };
      })()
    : DEFAULT_CONFIG;

  if (!overrides) return base;

  const o = overrides;
  const type = (o.effectType && o.effectType !== "auto" ? o.effectType : base.type) as ResolvedSceneConfig["type"];
  const baseParticles = base.particleCount;
  const needsParticles = type === "rain" || type === "snow" || type === "thunderstorm";
  const defaultParticleCount = 1500;
  const particleCount =
    o.particleCount !== undefined && o.particleCount !== "auto"
      ? o.particleCount
      : needsParticles && baseParticles === 0
        ? defaultParticleCount
        : baseParticles;
  return {
    type,
    intensity: (o.intensity && o.intensity !== "auto" ? o.intensity : base.intensity) as ResolvedSceneConfig["intensity"],
    particleCount,
    fogDensity:
      o.fogDensity !== undefined && o.fogDensity !== "auto"
        ? o.fogDensity
        : base.fogDensity,
    thunderstorm:
      o.thunderstorm !== undefined && o.thunderstorm !== "auto"
        ? o.thunderstorm
        : base.thunderstorm,
    cloudCover: base.cloudCover,
    windSpeed:
      o.windSpeed !== undefined && o.windSpeed !== "auto"
        ? o.windSpeed
        : base.windSpeed,
    windDirection:
      o.windDirection !== undefined && o.windDirection !== "auto"
        ? o.windDirection
        : base.windDirection,
    timeOfDay: (o.timeOfDay && o.timeOfDay !== "auto" ? o.timeOfDay : base.timeOfDay) as ResolvedSceneConfig["timeOfDay"],
    parallaxAmount:
      o.parallaxAmount !== undefined && o.parallaxAmount !== "auto"
        ? o.parallaxAmount
        : base.parallaxAmount,
  };
}

/** Sky colors per time of day */
const SKY_COLORS: Record<string, number> = {
  night: 0x0a0a1a,
  dawn: 0xff7b4a,
  day: 0x87ceeb,
  dusk: 0xff6b35,
};

interface WeatherSceneProps {
  weather: WeatherData | null;
  overrides?: DebugOverrides | null;
}

const WeatherScene: React.FC<WeatherSceneProps> = ({ weather, overrides }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<ResolvedSceneConfig>(resolveConfig(weather, overrides));
  configRef.current = resolveConfig(weather, overrides);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    rainPoints: THREE.Points | null;
    rainGeometry: THREE.BufferGeometry | null;
    rainCount: number;
    snowPoints: THREE.Points | null;
    snowGeometry: THREE.BufferGeometry | null;
    snowCount: number;
    cloudGroup: THREE.Group | null;
    frameId: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    container.appendChild(renderer.domElement);

    const config = configRef.current;
    const skyColor = SKY_COLORS[config.timeOfDay] ?? SKY_COLORS.day;
    scene.background = new THREE.Color(skyColor);
    scene.fog = null;

    const MAX_RAIN = 5000;
    const MAX_SNOW = 3000;
    const rainCount = MAX_RAIN;
    const snowCount = MAX_SNOW;

    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 30;
      rainPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(rainPositions, 3)
    );
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const rainMaterial = new THREE.PointsMaterial({
      color: 0x1e3a5f,
      size: 2.5 * pixelRatio,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: false,
      depthWrite: false,
      depthTest: true,
    });
    const rainPoints = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rainPoints);

    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 30;
      snowPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const snowGeometry = new THREE.BufferGeometry();
    snowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(snowPositions, 3)
    );
    const snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
    });
    const snowPoints = new THREE.Points(snowGeometry, snowMaterial);
    scene.add(snowPoints);

    const cloudGroup = new THREE.Group();
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const cloudGeom = new THREE.SphereGeometry(1.2, 10, 8);
    const numClouds = 14;
    for (let i = 0; i < numClouds; i++) {
      const cloud = new THREE.Mesh(
        cloudGeom.clone(),
        cloudMaterial.clone()
      );
      cloud.scale.set(
        2 + Math.random() * 2.5,
        0.2 + Math.random() * 0.25,
        1.5 + Math.random() * 2
      );
      cloud.position.set(
        (Math.random() - 0.5) * 24,
        2.5 + Math.random() * 5,
        (Math.random() - 0.5) * 16 - 4
      );
      cloud.rotation.x = Math.random() * 0.3;
      cloud.rotation.z = Math.random() * 0.4;
      cloudGroup.add(cloud);
    }
    scene.add(cloudGroup);

    const refState = {
      mouseX: 0,
      mouseY: 0,
      rainFallSpeed:
        config.intensity === "heavy"
          ? 0.6
          : config.intensity === "moderate"
            ? 0.4
            : 0.25,
      snowFallSpeed:
        config.intensity === "heavy"
          ? 0.08
          : config.intensity === "moderate"
            ? 0.05
            : 0.03,
      snowWindFactor: 0.4,
    };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      refState.mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      refState.mouseY = -((e.clientY - rect.top) / rect.height - 0.5);
    };
    window.addEventListener("mousemove", handleMouseMove);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      rainPoints,
      rainGeometry,
      rainCount,
      snowPoints,
      snowGeometry,
      snowCount,
      cloudGroup,
      frameId: 0,
      mouseX: 0,
      mouseY: 0,
    };

    const animate = () => {
      const ref = sceneRef.current;
      if (!ref) return;
      ref.frameId = requestAnimationFrame(animate);
      ref.mouseX = refState.mouseX;
      ref.mouseY = refState.mouseY;

      const parallax = configRef.current.parallaxAmount;
      ref.camera.position.x = ref.mouseX * parallax * 2;
      ref.camera.position.y = ref.mouseY * parallax * 2;
      ref.camera.lookAt(0, 0, 0);
      ref.camera.updateMatrixWorld(true);

      const cfg = configRef.current;
      const showRain =
        cfg.type === "rain" || cfg.type === "thunderstorm";
      const showSnow = cfg.type === "snow";
      const activeRainCount = showRain ? cfg.particleCount : 0;
      const activeSnowCount = showSnow ? cfg.particleCount : 0;
      if (ref.rainPoints) {
        ref.rainPoints.visible = showRain;
        ref.rainGeometry?.setDrawRange(0, activeRainCount);
      }
      if (ref.snowPoints) {
        ref.snowPoints.visible = showSnow;
        ref.snowGeometry?.setDrawRange(0, activeSnowCount);
      }

      const windSpeed = cfg.windSpeed ?? 0;
      const windDirection = (cfg.windDirection ?? 0) * (Math.PI / 180);
      const windScale = 0.012;
      const windX = Math.sin(windDirection) * windSpeed * windScale;
      const windZ = -Math.cos(windDirection) * windSpeed * windScale;

      if (ref.rainPoints && ref.rainGeometry && showRain) {
        const pos = ref.rainGeometry.attributes.position
          .array as Float32Array;
        for (let i = 0; i < Math.min(ref.rainCount, activeRainCount); i++) {
          const i3 = i * 3;
          pos[i3] += windX;
          pos[i3 + 1] -= refState.rainFallSpeed;
          pos[i3 + 2] += windZ;
          if (pos[i3 + 1] < -12) pos[i3 + 1] = 12;
          if (pos[i3] < -16) pos[i3] = 16;
          if (pos[i3] > 16) pos[i3] = -16;
        }
        ref.rainGeometry.attributes.position.needsUpdate = true;
      }
      if (ref.snowPoints && ref.snowGeometry && showSnow) {
        const pos = ref.snowGeometry.attributes.position
          .array as Float32Array;
        const sw = windX * refState.snowWindFactor;
        const sz = windZ * refState.snowWindFactor;
        for (let i = 0; i < Math.min(ref.snowCount, activeSnowCount); i++) {
          const i3 = i * 3;
          pos[i3] += sw;
          pos[i3 + 1] -= refState.snowFallSpeed;
          pos[i3 + 2] += sz;
          if (pos[i3 + 1] < -12) pos[i3 + 1] = 12;
          if (pos[i3] < -16) pos[i3] = 16;
          if (pos[i3] > 16) pos[i3] = -16;
        }
        ref.snowGeometry.attributes.position.needsUpdate = true;
      }

      ref.renderer.render(ref.scene, ref.camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !sceneRef.current) return;
      const { camera, renderer } = sceneRef.current;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.frameId);
        sceneRef.current.renderer.dispose();
        if (container.contains(sceneRef.current.renderer.domElement)) {
          container.removeChild(sceneRef.current.renderer.domElement);
        }
      }
      sceneRef.current = null;
    };
  }, []);

  // Update scene when weather or overrides change
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const config = configRef.current;
    const skyColor = SKY_COLORS[config.timeOfDay] ?? SKY_COLORS.day;
    ref.scene.background = new THREE.Color(skyColor);
    if (config.fogDensity > 0) {
      ref.scene.fog = new THREE.FogExp2(
        new THREE.Color(skyColor),
        config.fogDensity
      );
    } else {
      ref.scene.fog = null;
    }
    const cover = config.cloudCover ?? 0.4;
    const cloudOpacity = 0.12 + cover * 0.78;
    if (ref.cloudGroup) {
      ref.cloudGroup.visible = cover > 0.02;
      ref.cloudGroup.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (mat.opacity !== undefined) mat.opacity = cloudOpacity;
      });
    }
  }, [weather, overrides]);

  // Thunderstorm flash
  useEffect(() => {
    if (!configRef.current.thunderstorm) return;
    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 5000;
      return setTimeout(() => {
        setFlashOpacity(0.45);
        setTimeout(() => setFlashOpacity(0), 120);
        timeoutRef.current = scheduleNext();
      }, delay);
    };
    const timeoutRef = { current: scheduleNext() as ReturnType<typeof setTimeout> };
    return () => clearTimeout(timeoutRef.current);
  }, [weather, overrides]);

  return (
    <div ref={containerRef} className="weather-scene-container" aria-hidden="true">
      <div
        className="weather-scene-flash"
        style={{
          opacity: flashOpacity,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default WeatherScene;
