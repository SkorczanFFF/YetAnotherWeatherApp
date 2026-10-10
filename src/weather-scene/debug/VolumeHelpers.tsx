import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial } from "three";
import {
  bottomAt,
  halfWidthAt,
  type PrecipVolume,
  topAt,
  type ViewFrame,
} from "../core/viewVolume";
import { deckFootprint } from "../layers/CloudDeck";
import { RAIN_VOLUME, SNOW_VOLUME } from "../layers/precip/Precipitation";

interface VolumeHelpersProps {
  frame: ViewFrame;
}

type Corner = [number, number, number];

/** 12 edges of a hexahedron given near (4) and far (4) corners in the order ll, lr, ur, ul. */
function boxEdges(near: Corner[], far: Corner[]): Corner[] {
  const out: Corner[] = [];
  for (let i = 0; i < 4; i++) {
    out.push(near[i], near[(i + 1) % 4]);
    out.push(far[i], far[(i + 1) % 4]);
    out.push(near[i], far[i]);
  }
  return out;
}

function precipCorners(frame: ViewFrame, v: PrecipVolume, d: number): Corner[] {
  const top = topAt(frame, v, d);
  const bottom = bottomAt(frame, v, d);
  const hw = halfWidthAt(frame, d, top) + v.pad;
  return [
    [-hw, bottom, -d],
    [hw, bottom, -d],
    [hw, top, -d],
    [-hw, top, -d],
  ];
}

/**
 * Debug: wireframes of every spawn volume — fallback deck (cyan), rain
 * (blue), snow/hail (white). One draw. The volumetric clouds have no volume
 * to show: they are raymarched per pixel of the view. Use with the free
 * camera (C) to confirm nothing lives outside the base camera's view.
 */
export function VolumeHelpers({ frame }: VolumeHelpersProps) {
  const geometry = useMemo(() => {
    const segments: { pts: Corner[]; color: Color }[] = [];

    const deck = deckFootprint(frame);
    segments.push({
      color: new Color("#3fd5ff"),
      pts: (() => {
        const c: Corner[] = [
          [-deck.hwNear, deck.y, -deck.dNear],
          [deck.hwNear, deck.y, -deck.dNear],
          [deck.hwFar, deck.y, -deck.dFar],
          [-deck.hwFar, deck.y, -deck.dFar],
        ];
        return [c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0]];
      })(),
    });

    segments.push({
      color: new Color("#4d7dff"),
      pts: boxEdges(
        precipCorners(frame, RAIN_VOLUME, RAIN_VOLUME.dNear),
        precipCorners(frame, RAIN_VOLUME, RAIN_VOLUME.dFar),
      ),
    });
    segments.push({
      color: new Color("#ffffff"),
      pts: boxEdges(
        precipCorners(frame, SNOW_VOLUME, SNOW_VOLUME.dNear),
        precipCorners(frame, SNOW_VOLUME, SNOW_VOLUME.dFar),
      ),
    });

    const count = segments.reduce((n, s) => n + s.pts.length, 0);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    let i = 0;
    for (const s of segments) {
      for (const p of s.pts) {
        pos.set(p, i * 3);
        col.set([s.color.r, s.color.g, s.color.b], i * 3);
        i++;
      }
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(pos, 3));
    geom.setAttribute("color", new BufferAttribute(col, 3));
    return geom;
  }, [frame]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new LineBasicMaterial({
        vertexColors: true,
        depthTest: false,
        fog: false,
        toneMapped: false,
        transparent: true,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      renderOrder={10}
      frustumCulled={false}
    />
  );
}
