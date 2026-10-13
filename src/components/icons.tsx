import React, { useId } from "react";

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

// ---------------------------------------------------------------------------
// Weather icons: one line-art set for every WMO code Open-Meteo returns.

/** Cloud outline, flat base at y = 18, spanning x 3–21. */
export const CLOUD_PATH = "M7 18a4 4 0 1 1 0-8 5 5 0 0 1 9.7 1A4 4 0 1 1 17 18H7Z";
/** Crescent moon, roughly centred on (12, 12). */
const MOON = "M21 13.5A8.5 8.5 0 1 1 10.5 3a6.5 6.5 0 0 0 10.5 10.5Z";

/** A cloud placed by the centre of its base and a scale. */
interface CloudPlace {
  cx: number;
  by: number;
  s: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const cloudTransform = ({ cx, by, s }: CloudPlace) =>
  `translate(${r2(cx - 12 * s)} ${r2(by - 18 * s)}) scale(${s})`;

// Scaled shapes divide the stroke by their scale, so every line keeps the
// icon's stroke width (non-scaling-stroke would pin it to screen pixels).
const Cloud = ({ place, sw }: { place: CloudPlace; sw: number }) => (
  <path d={CLOUD_PATH} transform={cloudTransform(place)} strokeWidth={r2(sw / place.s)} />
);

const Sun = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => {
  let rays = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    rays += `M${r2(cx + c * r * 1.67)} ${r2(cy + s * r * 1.67)}L${r2(cx + c * r * 2.1)} ${r2(cy + s * r * 2.1)}`;
  }
  return (
    <>
      <circle cx={cx} cy={cy} r={r} />
      <path d={rays} />
    </>
  );
};

const Moon = ({ cx, cy, k, sw, flip = false }: { cx: number; cy: number; k: number; sw: number; flip?: boolean }) => (
  <path
    d={MOON}
    transform={`translate(${r2(cx - 12 * k)} ${r2(cy - 12 * k)}) scale(${k})${flip ? " rotate(180 12 12)" : ""}`}
    strokeWidth={r2(sw / k)}
  />
);

type Mark = "drop" | "dot" | "flake";

/** Six-armed snowflake centred on (x, y). */
const flake = (x: number, y: number) =>
  `M${x} ${r2(y - 1.3)}v2.6M${r2(x - 1.1)} ${r2(y - 0.65)}l2.2 1.3M${r2(x - 1.1)} ${r2(y + 0.65)}l2.2-1.3`;

/** Mark positions under a cloud, by count. */
const MARK_X: Record<number, number[]> = {
  1: [12],
  2: [9.5, 14.5],
  3: [8, 12, 16],
  4: [7, 10.3, 13.6, 16.9],
};

const Marks = ({ marks, dx = 0, strokeWidth }: { marks: Mark[]; dx?: number; strokeWidth: number }) => (
  <>
    {marks.map((mark, i) => {
      const x = MARK_X[marks.length][i] + dx;
      switch (mark) {
        case "drop":
          return <path key={i} d={`M${r2(x + 0.6)} 18l-1.2 3.2`} />;
        case "dot":
          return (
            <path key={i} d={`M${x} ${i % 2 ? 21.6 : 18.6}v.01`} strokeWidth={strokeWidth * 1.5} />
          );
        case "flake":
          return (
            <path
              key={i}
              d={flake(x, i % 2 ? 21.4 : 19)}
            />
          );
      }
      return null;
    })}
  </>
);

/** 1 light · 2 moderate · 3 heavy, from the WMO code. */
const LEVEL: Record<number, number> = {
  51: 1, 53: 2, 55: 3, 56: 1, 57: 3,
  61: 1, 63: 2, 65: 3, 66: 1, 67: 3,
  71: 1, 73: 2, 75: 3, 77: 1,
  80: 1, 81: 2, 82: 3, 85: 1, 86: 3,
};

const repeat = (n: number, cycle: Mark[]): Mark[] =>
  Array.from({ length: n }, (_, i) => cycle[i % cycle.length]);

/** Falling marks for a precipitation code (null when it isn't one). */
function precipMarks(code: number): Mark[] | null {
  const n = (LEVEL[code] ?? 2) + 1;
  if (code >= 51 && code <= 55) return repeat(n, ["dot"]);
  if (code === 56 || code === 57) return repeat(n, ["dot", "flake"]);
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return repeat(n, ["drop"]);
  if (code === 66 || code === 67) return repeat(n, ["drop", "flake"]);
  if ((code >= 71 && code <= 75) || code === 85 || code === 86) return repeat(Math.min(n, 3), ["flake"]);
  if (code === 77) return ["flake", "dot", "flake"];
  return null;
}

interface WeatherIconProps {
  /** WMO weather code. */
  code: number;
  /** Night swaps the sun for the moon. */
  isDay?: boolean;
  className?: string;
  /** Sun, moon and lightning in the warm accent; the rest in `currentColor`. */
  tinted?: boolean;
}

/**
 * Line-art icon for a WMO weather code, coloured by `currentColor`. Covers
 * every code Open-Meteo returns: sky state (0–3, sun/moon by day/night),
 * fog and rime fog, drizzle, rain, freezing drizzle/rain, snow, snow grains,
 * rain/snow showers (sun or moon behind the cloud), thunderstorms with and
 * without hail; drop count follows the intensity. Anything else is a cloud.
 */
export const WeatherIcon = ({
  code,
  isDay = true,
  className,
  tinted = false,
}: WeatherIconProps): React.ReactElement => {
  const strokeWidth = 1.5;
  const maskId = `wi${useId()}`;
  const warm = tinted ? { stroke: "var(--accent-warm)" } : undefined;
  const c = Math.floor(code);

  /** `behind` drawn under a cloud, cut out where the cloud is so outlines don't cross. */
  const occluded = (behind: React.ReactNode, front: CloudPlace, tintBehind = true) => (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <path
          d={CLOUD_PATH}
          transform={cloudTransform(front)}
          fill="black"
          stroke="black"
          strokeWidth={r2((strokeWidth + 2.5) / front.s)}
        />
      </mask>
      <g mask={`url(#${maskId})`} style={tintBehind ? warm : undefined}>
        {behind}
      </g>
      <Cloud place={front} sw={strokeWidth} />
    </>
  );
  /** `flip` turns the crescent's bulk up-right, away from a cloud below-left of it. */
  const celestial = (cx: number, cy: number, r: number, flip = false) =>
    isDay ? <Sun cx={cx} cy={cy} r={r} /> : <Moon cx={cx} cy={cy} k={r / 4.5} sw={strokeWidth} flip={flip} />;

  let body: React.ReactNode;
  const marks = precipMarks(c);
  if (c === 0) {
    body = <g style={warm}>{celestial(12, 12, 4.5)}</g>;
  } else if (c === 1) {
    body = occluded(celestial(10, 10, 4), { cx: 15.5, by: 20, s: 0.55 });
  } else if (c === 2) {
    body = occluded(celestial(15, 8.5, 3.2), { cx: 11, by: 20, s: 0.85 });
  } else if (c === 3) {
    body = occluded(<Cloud place={{ cx: 15, by: 13, s: 0.6 }} sw={strokeWidth} />, { cx: 10.5, by: 20, s: 0.85 }, false);
  } else if (c === 45 || c === 48) {
    body =
      c === 45 ? (
        <path d="M3 8h13M5 12h15M3 16h11M16 16h5" />
      ) : (
        <>
          <path d="M3 8h10M5 12h15M3 16h11M16 16h5" />
          <path d={flake(19, 6.4)} />
        </>
      );
  } else if (c >= 95 && c <= 99) {
    // Hailstones beside the bolt: two with slight hail (96), three with heavy (99).
    body = (
      <>
        <Cloud place={{ cx: 12, by: 14.5, s: 0.9 }} sw={strokeWidth} />
        <path d="M13.2 15.5l-2.6 3.6h3.1l-2.3 3.9" style={warm} />
        {c >= 96 && (
          <>
            <circle cx={6.8} cy={19.5} r={1} />
            <circle cx={17.8} cy={18.8} r={1} />
            {c === 99 && <circle cx={16.2} cy={22.4} r={1} />}
          </>
        )}
      </>
    );
  } else if (marks && c >= 80 && c <= 86) {
    // Showers: sun or moon in the gaps of a convective cloud.
    body = (
      <>
        {occluded(celestial(17, 6.5, 2.6, true), { cx: 10.5, by: 15, s: 0.85 })}
        <Marks marks={marks} dx={-1.5} strokeWidth={strokeWidth} />
      </>
    );
  } else if (marks) {
    body = (
      <>
        <Cloud place={{ cx: 12, by: 15, s: 0.9 }} sw={strokeWidth} />
        <Marks marks={marks} strokeWidth={strokeWidth} />
      </>
    );
  } else {
    body = <Cloud place={{ cx: 12, by: 18, s: 1 }} sw={strokeWidth} />;
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
};
