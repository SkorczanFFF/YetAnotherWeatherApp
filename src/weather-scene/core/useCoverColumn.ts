import { useEffect, useState } from "react";

/** The page marks its centred content column with this attribute. */
const COVER_SELECTOR = "[data-scene-cover]";

/**
 * Half-width of the centred content column as a share of the canvas'
 * half-width (0 = nothing covers the scene, ≥ 1 = it spans the canvas), so
 * the sun and moon can stay in the side gutters (SceneDriver).
 */
export function useCoverColumn(canvasWidth: number): number {
  const [cover, setCover] = useState(0);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(COVER_SELECTOR);
      if (!el || canvasWidth <= 0) return setCover(0);
      const r = el.getBoundingClientRect();
      const mid = window.innerWidth / 2;
      setCover(Math.max(mid - r.left, r.right - mid) / (canvasWidth / 2));
    };
    measure();
    // The column appears after the first fetch, then only resizes.
    const resize = new ResizeObserver(measure);
    resize.observe(document.documentElement);
    let appear: MutationObserver | null = null;
    if (!document.querySelector(COVER_SELECTOR)) {
      appear = new MutationObserver(() => {
        if (!document.querySelector(COVER_SELECTOR)) return;
        appear?.disconnect();
        appear = null;
        measure();
      });
      appear.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      resize.disconnect();
      appear?.disconnect();
    };
  }, [canvasWidth]);

  return cover;
}
