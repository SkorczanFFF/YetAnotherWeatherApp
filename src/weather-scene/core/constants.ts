/** Scene-wide constants shared by several layers. */

/** Draw order of the layers, back to front (the composite and particles are transparent). */
export const RENDER_ORDER = {
  sky: -2,
  skyGrade: -1,
  sunGlow: -0.5,
  stars: 0,
  moon: 1,
  clouds: 2,
  precipitation: 4,
  thunder: 5,
  diamondDust: 6,
  lensFlare: 7,
  frost: 30,
} as const;

/** ACES exposure, tuned for drei <Sky>; cloud radiance and particles are tuned against it. */
export const TONE_EXPOSURE = 0.5;

/** Frame delta cap, s — a tab switch or hitch must not jump the simulation. */
export const MAX_DT = 0.1;
