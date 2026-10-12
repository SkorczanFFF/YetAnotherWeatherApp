import React from "react";

/** Map pin outline in a 24×24 viewBox. */
export const PIN_PATH = "M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z";

/** Outlined map pin, coloured by `currentColor`. */
export const PinIcon = ({ strokeWidth = 1.6 }: { strokeWidth?: number }): React.ReactElement => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PIN_PATH} />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);
