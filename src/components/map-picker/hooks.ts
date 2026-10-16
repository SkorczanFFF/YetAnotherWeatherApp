import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "../../utils/math";

/** Drawer width, dragged from its left edge between `min` and `max` px. */
export function useDrawerResize(min: number, max: number) {
  const [width, setWidth] = useState(min);

  const onResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const onMove = (moveEvent: MouseEvent) => {
      setWidth(clamp(startWidth + startX - moveEvent.clientX, min, max));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return { width, onResizeMouseDown };
}

/**
 * Whether map tiles are loading slowly, for the loading pill: Leaflet fires
 * "loading" on every pan/zoom, so only a load longer than `delayMs` counts.
 * Resets when the drawer closes.
 */
export function useSlowTileLoading(open: boolean, delayMs: number) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  // Stable: react-leaflet rebinds the handlers whenever this object changes.
  const tileEvents = useMemo(
    () => ({
      loading: () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLoading(true), delayMs);
      },
      load: () => {
        window.clearTimeout(timer.current);
        setLoading(false);
      },
    }),
    [delayMs],
  );
  useEffect(() => {
    if (open) return;
    window.clearTimeout(timer.current);
    setLoading(false);
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { loading, tileEvents };
}
