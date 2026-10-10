// Spawn/recycle bounds for particle effects. Sized to cover the camera's
// FOV cone at the particle depth — particles outside this box will be
// frustum-culled automatically AND are unlikely to be visible anyway.
// Mobile viewports are narrower, so we scale the width by the passed
// aspect ratio.

export interface ParticleBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

interface BoundsInput {
  /** Vertical FOV in degrees (matches camera.fov). */
  fov: number;
  /** Viewport aspect ratio (width / height). */
  aspect: number;
  /** Depth of particle volume FROM camera (positive number; camera is at z=5). */
  depthMin: number;
  depthMax: number;
  /** Top/bottom extension in scene units (rain lives in a tall column). */
  extraHeightTop: number;
  extraHeightBottom: number;
}

export function computeParticleBounds({
  fov,
  aspect,
  depthMin,
  depthMax,
  extraHeightTop,
  extraHeightBottom,
}: BoundsInput): ParticleBounds {
  // Width at the FAR end of the volume — defines horizontal extent so
  // particles near the far plane also stay in frame.
  const halfFovRad = (fov * Math.PI) / 360;
  const halfHeightFar = Math.tan(halfFovRad) * depthMax;
  const halfWidthFar = halfHeightFar * aspect;
  const CAM_Z = 5;
  return {
    xMin: -halfWidthFar,
    xMax: halfWidthFar,
    yMin: -halfHeightFar - extraHeightBottom,
    yMax: halfHeightFar + extraHeightTop,
    zMin: CAM_Z - depthMax,
    zMax: CAM_Z - depthMin,
  };
}
