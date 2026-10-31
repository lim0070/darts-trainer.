import { type Dart, dartNum } from './darts';
import { type BullMode, type OutMode, dartValue, isTreble } from './rules';
import { finishersByValue, scoringDarts } from './tables';

// Route suggestions: fewest darts first, then the lowest "difficulty" cost.
// Steel (separate bull) prefers trebles for setups and the classic doubles to finish.
// Soft (fat bull) treats the big 50 bull and singles as the easy targets.

const DOUBLE_RANK = [20, 16, 8, 10, 12, 18, 4, 6, 14, 2];
const ODD_DOUBLES = [3, 5, 7, 9, 11, 13, 15, 17, 19, 1];

type Profile = 'steel' | 'soft';

function setupCost(d: Dart, p: Profile): number {
  const n = dartNum(d);
  if (p === 'steel') {
    if (d === 'S25') return 6;
    if (d === 'D25') return 20;
    if (d[0] === 'T') return 1.5 * (20 - n);
    if (d[0] === 'D') return 30;
    return 2;
  }
  if (d === 'S25' || d === 'D25') return 2;
  if (d[0] === 'T') return 4 + 0.02 * (20 - n);
  if (d[0] === 'D') return 5 + 0.05 * (20 - n);
  return 1 + 0.02 * (20 - n);
}

function doubleRank(n: number): number {
  const i = DOUBLE_RANK.indexOf(n);
  if (i >= 0) return i;
  return DOUBLE_RANK.length + 1 + ODD_DOUBLES.indexOf(n);
}

function finisherCost(d: Dart, out: OutMode, p: Profile): number {
  if (out === 'open') return setupCost(d, p);
  if (isTreble(d)) return p === 'steel' ? 33 + setupCost(d, p) : setupCost(d, p) + 1;
  const isBullDart = d === 'S25' || d === 'D25';
  if (p === 'steel') return isBullDart ? DOUBLE_RANK.length * 3 : doubleRank(dartNum(d)) * 3;
  return isBullDart ? 2 : 5 + doubleRank(dartNum(d)) * 0.6;
}

function routeCost(route: Dart[], out: OutMode, p: Profile, bull: BullMode): number {
  let cost = route.length * 1000;
  for (let i = 0; i < route.length - 1; i++) cost += setupCost(route[i], p);
  cost += finisherCost(route[route.length - 1], out, p);
  // Tie-breaks: easier first dart, then the bigger first dart.
  const first = route[0];
  const firstCost = route.length === 1 ? 0 : setupCost(first, p);
  return cost + 0.01 * firstCost - 0.001 * dartValue(first, bull);
}

const cache = new Map<string, Dart[] | null>();

/** Best way to finish `r` with at most `dartsLeft` darts, or null if it can't be done. */
export function bestRoute(r: number, dartsLeft: number, out: OutMode, bull: BullMode): Dart[] | null {
  const key = `${r}|${dartsLeft}|${out}|${bull}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const result = computeRoute(r, dartsLeft, out, bull);
  cache.set(key, result);
  return result;
}

function computeRoute(r: number, dartsLeft: number, out: OutMode, bull: BullMode): Dart[] | null {
  if (!Number.isInteger(r) || r < 1 || dartsLeft < 1) return null;
  const p: Profile = bull === 'fat' ? 'soft' : 'steel';
  const fin = finishersByValue(out, bull);
  const darts = scoringDarts(bull);
  const max = Math.min(3, dartsLeft);
  for (let k = 1; k <= max; k++) {
    let best: Dart[] | null = null;
    let bestCost = Infinity;
    const consider = (route: Dart[]) => {
      const c = routeCost(route, out, p, bull);
      if (c < bestCost) {
        bestCost = c;
        best = route;
      }
    };
    if (k === 1) {
      for (const f of fin.get(r) ?? []) consider([f]);
    } else if (k === 2) {
      for (const s of darts) {
        const rest = r - dartValue(s, bull);
        if (rest <= 0) continue;
        for (const f of fin.get(rest) ?? []) consider([s, f]);
      }
    } else {
      for (const s1 of darts) {
        const after1 = r - dartValue(s1, bull);
        if (after1 <= 1) continue;
        for (const s2 of darts) {
          const rest = after1 - dartValue(s2, bull);
          if (rest <= 0) continue;
          for (const f of fin.get(rest) ?? []) consider([s1, s2, f]);
        }
      }
    }
    if (best) return best;
  }
  return null;
}
