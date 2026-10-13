import type { EmissionState, EmitterShape, Particle, ShapeJSON } from "three.quarks";
import type { Vector3 } from "three";
import {
  bottomAt,
  halfWidthAt,
  type PrecipVolume,
  sampleDistance,
  topAt,
  type ViewFrame,
} from "../../core/viewVolume";

interface ViewVolumeEmitterOptions {
  frame: ViewFrame;
  volume: PrecipVolume;
  /** Fall speed range, scene units/s. */
  fallMin: number;
  fallMax: number;
  /** Live wind velocity (m/s, world) — read at spawn time. */
  wind: Vector3;
  /** m/s of wind → scene units/s of drift. */
  windFactor: number;
  /** Number of texture tiles to pick from at random (snow atlas). */
  tiles?: number;
}

/**
 * three.quarks emitter that keeps every particle inside the view volume for its whole life:
 * a random visible point is traced back along its velocity to the entry edge (top, or the
 * upwind side in a gale) and lives until the exit edge, so nothing is simulated off-screen.
 * Built-in shapes don't fit: RectangleEmitter emits from the perimeter, GridEmitter along +Z.
 */
export class ViewVolumeEmitter implements EmitterShape {
  type = "view-volume";
  options: ViewVolumeEmitterOptions;
  /** Running mean particle life — turns "particles on screen" into an emission rate. */
  meanLife: number;

  constructor(options: ViewVolumeEmitterOptions, initialMeanLife: number) {
    this.options = options;
    this.meanLife = initialMeanLife;
  }

  initialize(particle: Particle, _state: EmissionState): void {
    const { frame, volume, fallMin, fallMax, wind, windFactor, tiles } = this.options;
    const d = sampleDistance(volume.dNear, volume.dFar);
    const yTop = topAt(frame, volume, d);
    const yBottom = bottomAt(frame, volume, d);
    const hw = halfWidthAt(frame, d, yTop) + volume.pad;

    const fall = fallMin + Math.random() * (fallMax - fallMin);
    const vx = wind.x * windFactor;
    const vz = wind.z * windFactor;

    const px = (Math.random() * 2 - 1) * hw;
    const py = yBottom + Math.random() * (yTop - yBottom);

    // Time back to the entry edge and forward to the exit edge (x and y only;
    // drift along z just changes the depth a little).
    let back = (yTop - py) / fall;
    let fwd = (py - yBottom) / fall;
    if (Math.abs(vx) > 1e-3) {
      const toLeft = (px + hw) / Math.abs(vx);
      const toRight = (hw - px) / Math.abs(vx);
      back = Math.min(back, vx > 0 ? toLeft : toRight);
      fwd = Math.min(fwd, vx > 0 ? toRight : toLeft);
    }
    const life = back + fwd;

    particle.position.set(px - vx * back, py + fall * back, -d - vz * back);
    particle.velocity.set(vx, -fall, vz);
    particle.life = life;
    this.meanLife += (life - this.meanLife) * 0.01;
    if (tiles && tiles > 1) {
      (particle as Particle & { uvTile: number }).uvTile = Math.floor(Math.random() * tiles);
    }
  }

  update(): void {}

  toJSON(): ShapeJSON {
    return { type: this.type };
  }

  clone(): EmitterShape {
    return new ViewVolumeEmitter({ ...this.options }, this.meanLife);
  }
}
