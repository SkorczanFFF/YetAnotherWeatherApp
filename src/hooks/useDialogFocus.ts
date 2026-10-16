import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Open dialogs, newest last: only the top one handles Tab and Escape. */
const openDialogs: HTMLElement[] = [];

/**
 * Keyboard behaviour of a modal panel while `open`: focus moves to
 * `initialFocus` (else the first focusable element), Tab cycles inside the
 * panel, Escape calls `onClose`, and closing gives focus back to whatever had
 * it before.
 */
export function useDialogFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
): void {
  const trigger = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    trigger.current = document.activeElement as HTMLElement | null;
    openDialogs.push(panel);
    const frame = requestAnimationFrame(() =>
      (initialFocus?.current ?? panel.querySelector<HTMLElement>(FOCUSABLE))?.focus(),
    );

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== panel) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      openDialogs.splice(openDialogs.indexOf(panel), 1);
      trigger.current?.focus();
      trigger.current = null;
    };
  }, [open, panelRef, initialFocus]);
}
