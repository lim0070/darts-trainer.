import type { Dart } from './darts';
import { dartValue, isFinisher, isInDart, type ThrowRules } from './rules';
import { canFinish, isPossibleVisitTotal, oneDartFinish, scoringDarts } from './tables';

export interface DartResult {
  remaining: number;
  isIn: boolean;
  scored: number;
  bust: boolean;
  checkout: boolean;
  /** The score before this dart could be finished with one dart. */
  atFinish: boolean;
}

/** Apply one dart in an 01 game. On a bust, `remaining` is the value before the dart. */
export function applyDart(remaining: number, isIn: boolean, d: Dart, rules: ThrowRules): DartResult {
  const atFinish = isIn && oneDartFinish(remaining, rules.outMode, rules.bull);
  let nowIn = isIn;
  if (!nowIn) {
    if (!isInDart(d, rules.inMode, rules.bull)) {
      return { remaining, isIn: false, scored: 0, bust: false, checkout: false, atFinish };
    }
    nowIn = true;
  }
  const v = dartValue(d, rules.bull);
  const next = remaining - v;
  const bust = next < 0 || (rules.outMode !== 'open' && next === 1) || (next === 0 && !isFinisher(d, rules.outMode, rules.bull));
  if (bust) return { remaining, isIn: nowIn, scored: 0, bust: true, checkout: false, atFinish };
  return { remaining: next, isIn: nowIn, scored: v, bust: false, checkout: next === 0, atFinish };
}

export interface VisitSim {
  remaining: number;
  isIn: boolean;
  points: number;
  used: number;
  atFinish: number;
  bust: boolean;
  checkout: boolean;
}

/** Play up to three darts from `start`. A bust restores the start of the visit. */
export function simulateVisit(start: number, startIn: boolean, darts: readonly Dart[], rules: ThrowRules): VisitSim {
  let rem = start;
  let isIn = startIn;
  let points = 0;
  let used = 0;
  let atF = 0;
  for (const d of darts) {
    if (used >= 3) break;
    const r = applyDart(rem, isIn, d, rules);
    used++;
    if (r.atFinish) atF++;
    if (r.bust) return { remaining: start, isIn: startIn, points: 0, used, atFinish: atF, bust: true, checkout: false };
    rem = r.remaining;
    isIn = r.isIn;
    points += r.scored;
    if (r.checkout) return { remaining: 0, isIn, points, used, atFinish: atF, bust: false, checkout: true };
  }
  return { remaining: rem, isIn, points, used, atFinish: atF, bust: false, checkout: false };
}

export type VisitOutcome = 'score' | 'checkout' | 'bust';
export interface VisitOption {
  used: number;
  atFinish: number[];
}
export type VisitAnalysis = { ok: false; reason: string } | { ok: true; outcome: VisitOutcome; total: number; options: VisitOption[] };

type Leaf = (sim: VisitSim) => void;

/** Visit every distinct way a visit can play out (each dart scoring or missing). */
function enumerate(start: number, startIn: boolean, rules: ThrowRules, onLeaf: Leaf, maxPoints = Infinity) {
  const alphabet: Dart[] = [...scoringDarts(rules.bull), 'M'];
  const walk = (rem: number, isIn: boolean, points: number, used: number, atF: number) => {
    for (const d of alphabet) {
      const r = applyDart(rem, isIn, d, rules);
      const nUsed = used + 1;
      const nAtF = atF + (r.atFinish ? 1 : 0);
      if (r.bust) {
        onLeaf({ remaining: start, isIn: startIn, points: 0, used: nUsed, atFinish: nAtF, bust: true, checkout: false });
        continue;
      }
      const nPoints = points + r.scored;
      if (nPoints > maxPoints) continue;
      if (r.checkout) {
        onLeaf({ remaining: 0, isIn: r.isIn, points: nPoints, used: nUsed, atFinish: nAtF, bust: false, checkout: true });
        continue;
      }
      if (nUsed === 3) {
        onLeaf({ remaining: r.remaining, isIn: r.isIn, points: nPoints, used: 3, atFinish: nAtF, bust: false, checkout: false });
      } else {
        walk(r.remaining, r.isIn, nPoints, nUsed, nAtF);
      }
    }
  };
  walk(start, startIn, 0, 0, 0);
}

function sortedOptions(map: Map<number, Set<number>>): VisitOption[] {
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([used, set]) => ({ used, atFinish: [...set].sort((a, b) => a - b) }));
}

/** Largest single-dart finish under these rules (60 open/master, 50 double). */
function maxOneDart(rules: ThrowRules): number {
  for (let v = 60; v > 0; v--) if (oneDartFinish(v, rules.outMode, rules.bull)) return v;
  return 0;
}

function bustOptions(remaining: number, isIn: boolean, rules: ThrowRules): VisitOption[] {
  if (!isIn || remaining > 180) return [{ used: 3, atFinish: [0] }];
  const set = new Set<number>();
  enumerate(remaining, isIn, rules, (sim) => {
    if (sim.bust) set.add(sim.atFinish);
  });
  if (set.size === 0) set.add(0);
  return [{ used: 3, atFinish: [...set].sort((a, b) => a - b) }];
}

/**
 * Check a keypad visit total against the score left and work out which follow-up
 * questions (darts used, darts at a finish) actually have more than one answer.
 */
export function analyzeVisitTotal(remaining: number, isIn: boolean, total: number, rules: ThrowRules, forceBust = false): VisitAnalysis {
  if (forceBust) return { ok: true, outcome: 'bust', total: 0, options: bustOptions(remaining, isIn, rules) };
  if (!Number.isInteger(total) || total < 0 || total > 180) {
    return { ok: false, reason: 'Enter a score from 0 to 180.' };
  }
  if (!isPossibleVisitTotal(total, rules.bull)) {
    return { ok: false, reason: `${total} can't be scored with three darts.` };
  }
  const left = remaining - total;
  if (left < 0 || (left === 1 && rules.outMode !== 'open')) {
    return { ok: true, outcome: 'bust', total: 0, options: bustOptions(remaining, isIn, rules) };
  }
  if (left === 0) {
    if (!isIn || !canFinish(remaining, 3, rules.outMode, rules.bull)) {
      return { ok: true, outcome: 'bust', total: 0, options: bustOptions(remaining, isIn, rules) };
    }
    const map = new Map<number, Set<number>>();
    enumerate(
      remaining,
      isIn,
      rules,
      (sim) => {
        if (!sim.checkout) return;
        const set = map.get(sim.used) ?? new Set<number>();
        set.add(sim.atFinish);
        map.set(sim.used, set);
      },
      remaining,
    );
    return { ok: true, outcome: 'checkout', total, options: sortedOptions(map) };
  }
  // A plain scoring visit. Only enumerate when a finish chance or the "in" rule matters.
  if (isIn && left > maxOneDart(rules)) {
    return { ok: true, outcome: 'score', total, options: [{ used: 3, atFinish: [0] }] };
  }
  const set = new Set<number>();
  enumerate(
    remaining,
    isIn,
    rules,
    (sim) => {
      if (!sim.bust && !sim.checkout && sim.points === total) set.add(sim.atFinish);
    },
    total,
  );
  if (set.size === 0) {
    return {
      ok: false,
      reason: isIn ? `${total} isn't possible from ${remaining}.` : `${total} isn't possible before your first in-dart.`,
    };
  }
  return { ok: true, outcome: 'score', total, options: [{ used: 3, atFinish: [...set].sort((a, b) => a - b) }] };
}
