import { bestRoute } from '../checkout';
import { CRICKET_TARGETS, type CricketState } from '../cricket';
import { type Dart, NUMBERS, makeDart } from '../darts';
import { mulberry32, type Rng } from '../rng';
import { type BullMode, type ThrowRules, dartValue } from '../rules';
import { minDartsToFinish } from '../tables';
import { throwAt } from './throw';

const SCORING_AIMS: Dart[] = ['T20', 'T19', 'T18', 'D25'];
const evCache = new Map<string, Dart>();

/** The scoring target with the best expected points for this scatter (fat bull changes the answer). */
export function bestScoringAim(sigma: number, bull: BullMode): Dart {
  const key = `${sigma.toFixed(1)}|${bull}`;
  const hit = evCache.get(key);
  if (hit) return hit;
  const rng = mulberry32(1234);
  let best: Dart = 'T20';
  let bestEv = -1;
  for (const aim of SCORING_AIMS) {
    let sum = 0;
    for (let i = 0; i < 4000; i++) sum += dartValue(throwAt(aim, sigma, rng), bull);
    if (sum > bestEv) {
      bestEv = sum;
      best = aim;
    }
  }
  evCache.set(key, best);
  return best;
}

/** Where a bot aims its next dart in an 01 game. */
export function aim01(remaining: number, isIn: boolean, dartsLeft: number, rules: ThrowRules, sigma: number): Dart {
  if (!isIn) {
    if (rules.inMode === 'double') return rules.bull === 'fat' ? 'D25' : 'D20';
    return 'T20';
  }
  const route = bestRoute(remaining, dartsLeft, rules.outMode, rules.bull);
  if (route) return route[0];
  const safeFloor = rules.outMode === 'open' ? 60 : 62;
  if (remaining >= safeFloor) return bestScoringAim(sigma, rules.bull);
  return setupAim(remaining, rules);
}

/** No finish this visit: leave the friendliest score for the next one without busting. */
function setupAim(remaining: number, rules: ThrowRules): Dart {
  let best: Dart = 'S1';
  let bestScore = Infinity;
  const minLeft = rules.outMode === 'open' ? 1 : 2;
  for (const n of NUMBERS) {
    const d = makeDart(1, n);
    const left = remaining - dartValue(d, rules.bull);
    if (left < minLeft) continue;
    const darts = minDartsToFinish(left, rules.outMode, rules.bull);
    const route = bestRoute(left, 3, rules.outMode, rules.bull);
    const preferred = route && route.length === 1 && (route[0] === 'D20' || route[0] === 'D16' || route[0] === 'D8') ? -0.5 : 0;
    const score = darts + preferred - n * 0.001;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function botDart01(remaining: number, isIn: boolean, dartsLeft: number, rules: ThrowRules, sigma: number, rng: Rng): Dart {
  return throwAt(aim01(remaining, isIn, dartsLeft, rules, sigma), sigma, rng);
}

const aimFor = (idx: number): Dart => (idx === 6 ? 'D25' : makeDart(3, CRICKET_TARGETS[idx]));

/** Where a bot aims in Cricket. */
export function aimCricket(s: CricketState, p: number): Dart {
  const opps = Array.from({ length: s.seats }, (_, q) => q).filter((q) => q !== p);
  const mine = s.marks[p];
  const openFor = (q: number, i: number) => s.marks[q][i] < 3;
  const needed = [0, 1, 2, 3, 4, 5, 6].filter((i) => mine[i] < 3);
  const live = [0, 1, 2, 3, 4, 5, 6].filter((i) => mine[i] >= 3 && opps.some((q) => openFor(q, i)));
  const theirs = needed.filter((i) => opps.some((q) => s.marks[q][i] >= 3));
  if (opps.length === 0) return aimFor(needed[0] ?? 6);
  if (s.config.variant === 'standard') {
    const behind = s.points[p] <= Math.max(...opps.map((q) => s.points[q]));
    if ((behind || needed.length === 0) && live.length > 0) return aimFor(live[0]);
    if (theirs.length > 0) return aimFor(theirs[0]);
    return aimFor(needed[0] ?? live[0] ?? 0);
  }
  if (theirs.length > 0) return aimFor(theirs[0]);
  if (needed.length > 0) return aimFor(needed[0]);
  const lowest = s.points[p] <= Math.min(...opps.map((q) => s.points[q]));
  if (!lowest && live.length > 0) return aimFor(live[0]);
  return aimFor(live[0] ?? 0);
}

export function botDartCricket(s: CricketState, p: number, sigma: number, rng: Rng): Dart {
  return throwAt(aimCricket(s, p), sigma, rng);
}
