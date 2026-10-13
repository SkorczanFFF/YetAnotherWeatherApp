import {
  type Data3DTexture,
  LinearFilter,
  RepeatWrapping,
  ShaderMaterial,
  WebGL3DRenderTarget,
  type WebGLRenderer,
} from "three";
import { CLOUD_NOISE_FRAG } from "../../shaders/cloudNoise.glsl";
import { fullscreenVert } from "../../shaders/fullscreen.glsl";
import { fullscreenPass } from "./fullscreenPass";

// 3D noise: generated once per size on the GPU, slice by slice, then cached
// per renderer for the page's lifetime (the quality tier can come back to it;
// a remount with a new context must not reuse a dead context's texture).
const noiseCache = new WeakMap<WebGLRenderer, Map<number, WebGL3DRenderTarget>>();

export function getCloudNoise3D(gl: WebGLRenderer, size: number): Data3DTexture {
  let bySize = noiseCache.get(gl);
  if (!bySize) noiseCache.set(gl, (bySize = new Map()));
  const cached = bySize.get(size);
  if (cached) return cached.texture;
  const target = new WebGL3DRenderTarget(size, size, size, {
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  });
  target.texture.wrapS = RepeatWrapping;
  target.texture.wrapT = RepeatWrapping;
  target.texture.wrapR = RepeatWrapping;

  const pass = fullscreenPass(
    new ShaderMaterial({
      uniforms: { uSlice: { value: 0 } },
      vertexShader: fullscreenVert(),
      fragmentShader: CLOUD_NOISE_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const previous = gl.getRenderTarget();
  for (let z = 0; z < size; z++) {
    pass.material.uniforms.uSlice.value = (z + 0.5) / size;
    gl.setRenderTarget(target, z);
    gl.render(pass.scene, pass.camera);
  }
  gl.setRenderTarget(previous);
  pass.dispose();
  bySize.set(size, target);
  return target.texture;
}
