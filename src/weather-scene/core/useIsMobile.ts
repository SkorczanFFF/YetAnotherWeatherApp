import { useMemo } from "react";

// Mobile detection for the initial quality tier: mobile UA or a coarse pointer
// on a ≤ 900 px viewport. Resolved once so a window resize never retunes budgets.

export function useIsMobile(): boolean {
  return useMemo(
    () =>
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches,
    [],
  );
}
