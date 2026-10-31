import { SCORING_DARTS, type Dart } from './darts';
import { dartValue, isFinisher, type BullMode, type OutMode } from './rules';

/** Darts with a distinct scoring identity. With fat bull the outer bull is the same as the bull. */
export function scoringDarts(bull: BullMode): readonly Dart[] {
  return bull === 'fat' ? SCORING_DARTS.filter((d) => d !== 'S25') : SCORING_DARTS;
}

function distinctValues(bull: BullMode): number[] {
  return [...new Set(scoringDarts(bull).map((d) => dartValue(d, bull)))].sort((a, b) => a - b);
}

const totalsCache = new Map<BullMode, Set<number>>();

/** Every total three darts (misses allowed) can make. */
export function visitTotals(bull: BullMode): Set<number> {
  let set = totalsCache.get(bull);
  if (set) return set;
  const vals = [0, ...distinctValues(bull)];
  set = new Set<number>();
  for (const a of vals) for (const b of vals) for (const c of vals) set.add(a + b + c);
  totalsCache.set(bull, set);
  return set;
}

export function isPossibleVisitTotal(total: number, bull: BullMode): boolean {
  return Number.isInteger(total) && total >= 0 && total <= 180 && visitTotals(bull).has(total);
}

export function impossibleTotals(bull: BullMode): number[] {
  const out: number[] = [];
  for (let t = 0; t <= 180; t++) if (!visitTotals(bull).has(t)) out.push(t);
  return out;
}

const finisherCache = new Map<string, Map<number, Dart[]>>();

/** Finishing darts grouped by the score they finish. */
export function finishersByValue(out: OutMode, bull: BullMode): Map<number, Dart[]> {
  const key = `${out}|${bull}`;
  let map = finisherCache.get(key);
  if (map) return map;
  map = new Map();
  for (const d of scoringDarts(bull)) {
    if (!isFinisher(d, out, bull)) continue;
    const v = dartValue(d, bull);
    const list = map.get(v) ?? [];
    list.push(d);
    map.set(v, list);
  }
  finisherCache.set(key, map);
  return map;
}

const NO_FINISH = 9;
const minDartsCache = new Map<string, Int8Array>();

function minDartsTable(out: OutMode, bull: BullMode): Int8Array {
  const key = `${out}|${bull}`;
  let table = minDartsCache.get(key);
  if (table) return table;
  table = new Int8Array(181).fill(NO_FINISH);
  const fin = finishersByValue(out, bull);
  const setups = distinctValues(bull);
  for (let r = 1; r <= 180; r++) {
    if (fin.has(r)) {
      table[r] = 1;
      continue;
    }
    let two = false;
    for (const s of setups) {
      if (s < r && fin.has(r - s)) {
        two = true;
        break;
      }
    }
    if (two) {
      table[r] = 2;
      continue;
    }
    outer: for (const s1 of setups) {
      for (const s2 of setups) {
        const rest = r - s1 - s2;
        if (rest > 0 && fin.has(rest)) {
          table[r] = 3;
          break outer;
        }
      }
    }
  }
  minDartsCache.set(key, table);
  return table;
}

/** Fewest darts that can finish r (1–3), or Infinity. */
export function minDartsToFinish(r: number, out: OutMode, bull: BullMode): number {
  if (!Number.isInteger(r) || r < 1 || r > 180) return Infinity;
  const v = minDartsTable(out, bull)[r];
  return v === NO_FINISH ? Infinity : v;
}

export function canFinish(r: number, darts: number, out: OutMode, bull: BullMode): boolean {
  return minDartsToFinish(r, out, bull) <= darts;
}

export function oneDartFinish(r: number, out: OutMode, bull: BullMode): boolean {
  return minDartsToFinish(r, out, bull) === 1;
}

/** Highest score that can be finished in one visit. */
export function maxFinish(out: OutMode, bull: BullMode): number {
  for (let r = 180; r > 0; r--) if (canFinish(r, 3, out, bull)) return r;
  return 0;
}

/** Scores up to maxFinish that can't be finished in three darts ("bogey numbers"). */
export function bogeyNumbers(out: OutMode, bull: BullMode): number[] {
  const max = maxFinish(out, bull);
  const list: number[] = [];
  for (let r = 2; r <= max; r++) if (!canFinish(r, 3, out, bull)) list.push(r);
  return list;
}
