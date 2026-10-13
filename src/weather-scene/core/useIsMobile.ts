import { useMemo } from "react";

// Mobile detection for the initial quality tier: mobile UA or a coarse pointer
// on a ≤ 900 px viewport. Resolved once so a window resize never retunes budgets.

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
