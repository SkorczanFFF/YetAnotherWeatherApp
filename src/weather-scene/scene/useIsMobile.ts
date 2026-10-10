import { useMemo } from "react";

// Mobile detection for per-platform scene budgets. Resolved once at mount
// and memoised for the scene's lifetime — we don't want the viewport
// flipping between mobile and desktop on a laptop resize and retuning
// every particle count.
//
// Two signals, OR-ed together:
//   1. User agent test (Android / iPhone / iPad / iPod). Coarse but reliable.
//   2. `matchMedia('(pointer: coarse) and (max-width: 900px)')`. Catches
//      tablets and Android Chrome with requestDesktopSite toggled off.

export function useIsMobile(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
    if (typeof window !== "undefined" && window.matchMedia) {
      try {
        return window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches;
      } catch {
        return false;
      }
    }
    return false;
  }, []);
}
