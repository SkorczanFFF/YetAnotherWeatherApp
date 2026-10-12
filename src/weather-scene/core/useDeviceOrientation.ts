import { useEffect, useRef, useCallback } from "react";

const TILT_RANGE = 30;

interface DeviceOrientationState {
  x: number;
  y: number;
  available: boolean;
}

/**
 * Provides normalized device orientation (-1..1) for parallax on mobile.
 * On iOS 13+, automatically requests permission on first user tap.
 * Falls back gracefully: if no gyroscope or permission denied, available stays false.
 */
export function useDeviceOrientation(): React.MutableRefObject<DeviceOrientationState> {
  const orientation = useRef<DeviceOrientationState>({
    x: 0,
    y: 0,
    available: false,
  });

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;

    const angle =
      (window.screen?.orientation?.angle as number) ??
      (window.orientation as number) ??
      0;

    let tiltX: number;
    let tiltY: number;

    switch (angle) {
      case 90:
        tiltX = e.beta - 90;
        tiltY = -e.gamma;
        break;
      case 270:
      case -90:
        tiltX = -(e.beta - 90);
        tiltY = e.gamma;
        break;
      case 180:
        tiltX = -e.gamma;
        tiltY = -(e.beta - 90);
        break;
      default:
        tiltX = e.gamma;
        tiltY = e.beta - 90;
    }

    orientation.current.x = Math.max(-1, Math.min(1, tiltX / TILT_RANGE));
    orientation.current.y = Math.max(-1, Math.min(1, -tiltY / TILT_RANGE));
    orientation.current.available = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.DeviceOrientationEvent) return;

    const needsPermission =
      typeof (DeviceOrientationEvent as any).requestPermission === "function";

    if (!needsPermission) {
      window.addEventListener("deviceorientation", handleOrientation);
      return () =>
        window.removeEventListener("deviceorientation", handleOrientation);
    }

    // iOS 13+: request permission on first user tap
    let requested = false;
    const onFirstInteraction = async () => {
      if (requested) return;
      requested = true;
      try {
        const result = await (
          DeviceOrientationEvent as any
        ).requestPermission();
        if (result === "granted") {
          window.addEventListener("deviceorientation", handleOrientation);
        }
      } catch {
        // Permission denied or error — fall back to pointer
      }
      document.removeEventListener("click", onFirstInteraction);
      document.removeEventListener("touchend", onFirstInteraction);
    };

    document.addEventListener("click", onFirstInteraction, { once: true });
    document.addEventListener("touchend", onFirstInteraction, { once: true });

    return () => {
      document.removeEventListener("click", onFirstInteraction);
      document.removeEventListener("touchend", onFirstInteraction);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [handleOrientation]);

  return orientation;
}
