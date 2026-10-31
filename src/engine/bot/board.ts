import { type Dart, SEGMENT_ORDER, makeDart } from '../darts';

/** Standard board radii in millimetres. */
export const RADII = {
  innerBull: 6.35,
  outerBull: 15.9,
  trebleIn: 99,
  trebleOut: 107,
  doubleIn: 162,
  doubleOut: 170,
} as const;

export interface Point {
  x: number;
  y: number;
}

/** Which bed a point (mm, y up, origin at the bull) lands in. */
export function segmentAt(x: number, y: number): Dart {
  const r = Math.hypot(x, y);
  if (r <= RADII.innerBull) return 'D25';
  if (r <= RADII.outerBull) return 'S25';
  if (r > RADII.doubleOut) return 'M';
  let deg = (Math.atan2(x, y) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const idx = Math.floor(((deg + 9) % 360) / 18);
  const n = SEGMENT_ORDER[idx];
  if (r > RADII.trebleIn && r <= RADII.trebleOut) return makeDart(3, n);
  if (r > RADII.doubleIn) return makeDart(2, n);
  return makeDart(1, n);
}

function polar(n: number, radius: number): Point {
  const idx = SEGMENT_ORDER.indexOf(n as (typeof SEGMENT_ORDER)[number]);
  const a = (idx * 18 * Math.PI) / 180;
  return { x: radius * Math.sin(a), y: radius * Math.cos(a) };
}

/** Where a player aims to hit a given bed. */
export function aimPoint(d: Dart): Point {
  if (d === 'D25' || d === 'S25' || d === 'M') return { x: 0, y: 0 };
  const n = Number(d.slice(1));
  if (d[0] === 'T') return polar(n, (RADII.trebleIn + RADII.trebleOut) / 2);
  if (d[0] === 'D') return polar(n, (RADII.doubleIn + RADII.doubleOut) / 2);
  return polar(n, (RADII.trebleOut + RADII.doubleIn) / 2);
}
