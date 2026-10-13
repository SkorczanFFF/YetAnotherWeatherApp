import { useEffect } from "react";

/** Set to 1 (non-inherited, see index.scss) by the glass-reveal mixin. */
const SPOT_VAR = "--glass-spot";
const MAP_PANE = ".leaflet-map-pane";
/** Every element except the scene canvas and Leaflet's tiles and markers. */
const SCAN = `body *:not(canvas, ${MAP_PANE} *)`;
/** `$glass-reveal` in _glass.scss — past this distance an element's edge is dark. */
const REVEAL_PX = 160;
const OFF = "-999px";

const isGlassCache = new WeakMap<Element, boolean>();

function isGlass(el: Element): boolean {
  let glass = isGlassCache.get(el);
  if (glass === undefined) {
    glass = getComputedStyle(el).getPropertyValue(SPOT_VAR).trim() === "1";
    isGlassCache.set(el, glass);
  }
  return glass;
}

/** Distance from a point to a rect, 0 inside it. */
function distanceTo(rect: DOMRect, x: number, y: number): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

/**
 * Feeds the cursor position (`--mx` / `--my`, px in each element's box) to
 * every glass-reveal element within reach of it, hovered or not, at most once
 * per frame — the mixin lights the near part of each edge and, on :hover, the
 * inside of liquid glass. Elements out of reach get their light parked
 * off-screen once.
 * Mouse only: touch has no cursor to follow.
 */
export function useGlassSpotlight(): void {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    let active = false;
    let glass: HTMLElement[] = [];
    let dirty = true;
    const lit = new Set<HTMLElement>();

    // Cards, the map drawer and the debug menu come and go; rescan lazily
    // after a DOM change. Leaflet's tile/marker churn never holds any.
    const observer = new MutationObserver((records) => {
      if (records.some((r) => !(r.target as Element).closest?.(MAP_PANE))) dirty = true;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const park = (el: HTMLElement) => {
      el.style.setProperty("--mx", OFF);
      el.style.setProperty("--my", OFF);
      lit.delete(el);
    };

    const update = () => {
      frame = 0;
      if (dirty) {
        dirty = false;
        glass = Array.from(document.querySelectorAll<HTMLElement>(SCAN)).filter(isGlass);
        for (const el of lit) if (!glass.includes(el)) lit.delete(el);
      }
      for (const el of glass) {
        const rect = el.getBoundingClientRect();
        if (active && distanceTo(rect, x, y) < REVEAL_PX) {
          el.style.setProperty("--mx", `${(x - rect.left).toFixed(1)}px`);
          el.style.setProperty("--my", `${(y - rect.top).toFixed(1)}px`);
          lit.add(el);
        } else if (lit.has(el)) {
          park(el);
        }
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      active = true;
      schedule();
    };

    // Cursor left the window: every edge goes dark.
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      active = false;
      schedule();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    // Scrolling moves the cards under a still cursor.
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
}
