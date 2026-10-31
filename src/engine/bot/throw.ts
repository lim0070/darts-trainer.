import type { Dart } from '../darts';
import { gaussian, type Rng } from '../rng';
import { aimPoint, segmentAt } from './board';

/** Throw at a bed with Gaussian scatter of `sigma` mm on each axis. */
export function throwAt(aim: Dart, sigma: number, rng: Rng): Dart {
  const p = aimPoint(aim);
  return segmentAt(p.x + gaussian(rng) * sigma, p.y + gaussian(rng) * sigma);
}

/** A bull-off dart: distance from the centre decides inner, outer or miss. */
export function corkThrow(sigma: number, rng: Rng): { result: 'inner' | 'outer' | 'miss'; mm: number } {
  const mm = Math.hypot(gaussian(rng) * sigma, gaussian(rng) * sigma);
  return { result: mm <= 6.35 ? 'inner' : mm <= 15.9 ? 'outer' : 'miss', mm };
}
