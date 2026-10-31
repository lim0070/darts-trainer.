import { type Dart, dartMult, dartNum } from './darts';
import type { CricketConfig, GameEvent, PendingPunish, Phase, VisitRecord } from './types';

/** Cricket targets in board order of importance: 20 … 15, then the bull. */
export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;

export function cricketIndex(d: Dart): number {
  const n = dartNum(d);
  if (n === 25) return 6;
  if (n >= 15 && n <= 20) return 20 - n;
  return -1;
}

/** Marks for a dart: S/D/T = 1/2/3, outer bull 1, inner bull 2. */
export function cricketMarks(d: Dart): number {
  if (cricketIndex(d) < 0) return 0;
  return dartMult(d);
}

export interface CricketLeg {
  index: number;
  starter: number;
  winner: number | null;
  byCork: boolean;
  complete: boolean;
}

export interface CricketState {
  kind: 'cricket';
  config: CricketConfig;
  seats: number;
  legs: CricketLeg[];
  visits: VisitRecord[];
  marks: number[][];
  points: number[];
  legsWon: number[];
  current: number;
  round: number;
  visitDarts: Dart[];
  visitMarks: number;
  visitStartPoints: number;
  phase: Phase;
  winner: number | null;
  pendingPunish: PendingPunish | null;
  lastClosed: { visitIdx: number; eventIdx: number } | null;
  ended: 'timeUp' | 'stopped' | null;
}

export function cricketInit(config: CricketConfig, seats: number): CricketState {
  const s: CricketState = {
    kind: 'cricket',
    config,
    seats,
    legs: [],
    visits: [],
    marks: [],
    points: [],
    legsWon: Array(seats).fill(0),
    current: 0,
    round: 1,
    visitDarts: [],
    visitMarks: 0,
    visitStartPoints: 0,
    phase: 'play',
    winner: null,
    pendingPunish: null,
    lastClosed: null,
    ended: null,
  };
  startLeg(s);
  return s;
}

function startLeg(s: CricketState) {
  const starter = s.legs.length % s.seats;
  s.legs.push({ index: s.legs.length, starter, winner: null, byCork: false, complete: false });
  s.marks = Array.from({ length: s.seats }, () => Array(7).fill(0));
  s.points = Array(s.seats).fill(0);
  s.current = starter;
  s.round = 1;
  s.visitDarts = [];
  s.visitMarks = 0;
}

const legOf = (s: CricketState) => s.legs[s.legs.length - 1];
const closedAll = (s: CricketState, p: number) => s.marks[p].every((m) => m >= 3);
const targetValue = (idx: number) => (idx === 6 ? 25 : CRICKET_TARGETS[idx]);

/** Apply one dart; returns the marks that counted (closing marks plus marks that scored). */
function scoreDart(s: CricketState, p: number, d: Dart): number {
  const idx = cricketIndex(d);
  if (idx < 0) return 0;
  const m = cricketMarks(d);
  const own = s.marks[p][idx];
  const closing = Math.min(m, Math.max(0, 3 - own));
  const extra = m - closing;
  s.marks[p][idx] = Math.min(3, own + closing);
  let counted = closing;
  if (extra > 0) {
    const open: number[] = [];
    for (let q = 0; q < s.seats; q++) if (q !== p && s.marks[q][idx] < 3) open.push(q);
    if (open.length > 0) {
      const pts = extra * targetValue(idx);
      if (s.config.variant === 'standard') s.points[p] += pts;
      else for (const q of open) s.points[q] += pts;
      counted += extra;
    }
  }
  return counted;
}

function findWinner(s: CricketState, thrower: number): number | null {
  if (s.seats === 1) return closedAll(s, 0) ? 0 : null;
  const qualifies = (p: number) => {
    if (!closedAll(s, p)) return false;
    for (let q = 0; q < s.seats; q++) {
      if (q === p) continue;
      if (s.config.variant === 'standard' ? s.points[p] < s.points[q] : s.points[p] > s.points[q]) return false;
    }
    return true;
  };
  if (qualifies(thrower)) return thrower;
  for (let p = 0; p < s.seats; p++) if (p !== thrower && qualifies(p)) return p;
  return null;
}

export function cricketApply(s: CricketState, ev: GameEvent, eventIdx: number): void {
  switch (ev.t) {
    case 'dart': {
      if (s.phase !== 'play' || s.pendingPunish) return;
      const p = s.current;
      if (s.visitDarts.length === 0) s.visitStartPoints = s.points[p];
      s.visitDarts.push(ev.d);
      s.visitMarks += scoreDart(s, p, ev.d);
      const winner = findWinner(s, p);
      if (winner !== null || s.visitDarts.length === 3) {
        closeVisit(s, p, eventIdx, ev.ts, winner !== null);
        if (winner !== null) finishLeg(s, winner, false);
        else advance(s);
      }
      return;
    }
    case 'cork':
      if (s.phase !== 'cork') return;
      s.phase = 'play';
      finishLeg(s, ev.winner, true);
      return;
    case 'punish':
      s.pendingPunish = { seat: ev.seat, trigger: ev.trigger, card: ev.card };
      return;
    case 'punishDone':
      s.pendingPunish = null;
      return;
    case 'end':
      if (s.phase === 'over') return;
      s.phase = 'over';
      s.ended = ev.reason;
      return;
    default:
      return;
  }
}

function closeVisit(s: CricketState, p: number, eventIdx: number, ts: number, won: boolean) {
  s.visits.push({
    seat: p,
    leg: legOf(s).index,
    round: s.round,
    start: s.visitStartPoints,
    total: s.points[p] - s.visitStartPoints,
    darts: [...s.visitDarts],
    used: s.visitDarts.length,
    atF: 0,
    bust: false,
    checkout: won,
    ts,
    marks: s.visitMarks,
  });
  s.visitDarts = [];
  s.visitMarks = 0;
  s.lastClosed = { visitIdx: s.visits.length - 1, eventIdx };
}

function advance(s: CricketState) {
  const leg = legOf(s);
  s.current = (s.current + 1) % s.seats;
  if (s.current !== leg.starter) return;
  const limit = s.config.roundLimit;
  if (limit !== null && s.round >= limit) {
    if (s.seats === 1) {
      finishLeg(s, null, false);
      return;
    }
    const best = s.config.variant === 'standard' ? Math.max(...s.points) : Math.min(...s.points);
    const leaders = s.points.map((pt, i) => (pt === best ? i : -1)).filter((i) => i >= 0);
    if (leaders.length === 1) finishLeg(s, leaders[0], false);
    else s.phase = 'cork';
    return;
  }
  s.round++;
}

function finishLeg(s: CricketState, winner: number | null, byCork: boolean) {
  const leg = legOf(s);
  leg.winner = winner;
  leg.byCork = byCork;
  leg.complete = true;
  if (winner !== null) s.legsWon[winner]++;
  const done = s.seats === 1 ? s.legs.length >= s.config.legsToWin : winner !== null && s.legsWon[winner] >= s.config.legsToWin;
  if (done) {
    s.phase = 'over';
    s.winner = s.seats === 1 ? null : winner;
    return;
  }
  startLeg(s);
}

export interface CricketStat {
  marks: number;
  darts: number;
  rounds: number;
  p80marks: number;
  p80rounds: number;
}

/** Marks per round over the whole game and up to 80% of the closing marks (17 of 21). */
export function cricketSeatStats(s: CricketState, seat: number): CricketStat {
  const out: CricketStat = { marks: 0, darts: 0, rounds: 0, p80marks: 0, p80rounds: 0 };
  for (const leg of s.legs) {
    if (!leg.complete) continue;
    let closing = 0;
    let reached = false;
    const marksBy = Array(7).fill(0);
    for (const v of s.visits) {
      if (v.leg !== leg.index || v.seat !== seat) continue;
      out.marks += v.marks ?? 0;
      out.darts += v.used;
      out.rounds++;
      if (!reached) {
        out.p80marks += v.marks ?? 0;
        out.p80rounds++;
        for (const d of v.darts ?? []) {
          const idx = cricketIndex(d);
          if (idx < 0) continue;
          const add = Math.min(cricketMarks(d), 3 - marksBy[idx]);
          marksBy[idx] += add;
          closing += add;
        }
        if (closing >= 17) reached = true;
      }
    }
  }
  return out;
}
