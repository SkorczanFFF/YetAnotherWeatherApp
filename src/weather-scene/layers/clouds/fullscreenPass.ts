import { Mesh, OrthographicCamera, PlaneGeometry, Scene, type ShaderMaterial } from "three";

/** An offscreen full-screen pass: one clip-space quad in its own scene. */
export function fullscreenPass(material: ShaderMaterial) {
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  return {
    material,
    scene: new Scene().add(quad),
    camera: new OrthographicCamera(),
    dispose() {
      material.dispose();
      quad.geometry.dispose();
    },
  };
}

export type FullscreenPass = ReturnType<typeof fullscreenPass>;
