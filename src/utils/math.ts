/** Scalar helpers for code outside the scene (which uses three's MathUtils, same argument order). */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
/** Hermite step of `x` between `e0` and `e1` (x first, like MathUtils — not GLSL's order). */
export const smoothstep = (x: number, e0: number, e1: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
