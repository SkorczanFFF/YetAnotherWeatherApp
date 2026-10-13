import { useEffect, useRef, useState } from "react";

/** Phones have no F7: this many quick taps on the footer status toggle the debug menu. */
const DEBUG_TAPS = 5;
const DEBUG_TAP_GAP_MS = 600;

/** Debug menu visibility: F7 toggles it; `onTap` counts quick taps for touch screens. */
export function useDebugToggle() {
  const [open, setOpen] = useState(false);
  const taps = useRef({ count: 0, last: 0 });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "F7") return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onTap = () => {
    const t = taps.current;
    const now = performance.now();
    t.count = now - t.last < DEBUG_TAP_GAP_MS ? t.count + 1 : 1;
    t.last = now;
    if (t.count >= DEBUG_TAPS) {
      t.count = 0;
      setOpen((prev) => !prev);
    }
  };

  return { open, setOpen, onTap };
}
