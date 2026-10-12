// Full-screen pass: a PlaneGeometry(2, 2) drawn straight in clip space.
// `depth` is the NDC z — 0 for offscreen passes and overlays, 1 to sit on the
// far plane (behind everything that writes depth).

export const fullscreenVert = (depth: 0 | 1 = 0): string => /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, ${depth.toFixed(1)}, 1.0);
}
`;
