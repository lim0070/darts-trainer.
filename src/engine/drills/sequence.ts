import { type Dart, dartNum, isBull } from '../darts';
import type { StatRow } from '../stats';
import type { GameEvent, PendingPunish, Phase, SequenceDrillConfig, VisitRecord } from '../types';

// Advance-on-hit drills: Around the Clock (1 → 20 → Bull) and Frustration (D1 → D20 → Bull).

export const SEQUENCE_TARGETS = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

export interface SeqPlayer {
  idx: number;
  darts: number;
  visits: number;
  hits: number;
  done: boolean;
  /** Darts (Around the Clock) or visits (Frustration) needed to finish. */
  finishedIn: number | null;
  ext: Record<string, number>;
}

export interface SeqState {
  kind: SequenceDrillConfig['kind'];
  config: SequenceDrillConfig;
  seats: number;
  players: SeqPlayer[];
  current: number;
  visitDarts: Dart[];
  visits: VisitRecord[];
  phase: Phase;
  winner: number | null;
  pendingPunish: PendingPunish | null;
  lastClosed: { visitIdx: number; eventIdx: number } | null;
  ended: 'timeUp' | 'stopped' | null;
}

export function seqInit(config: SequenceDrillConfig, seats: number): SeqState {
  return {
    kind: config.kind,
    config,
    seats,
    players: Array.from({ length: seats }, () => ({
      idx: 0,
      darts: 0,
      visits: 0,
      hits: 0,
      done: false,
      finishedIn: null,
      ext: {},
    })),
    current: 0,
    visitDarts: [],
    visits: [],
    phase: 'play',
    winner: null,
    pendingPunish: null,
    lastClosed: null,
    ended: null,
  };
}

export function seqTarget(s: SeqState, seat: number): number {
  return SEQUENCE_TARGETS[Math.min(s.players[seat].idx, SEQUENCE_TARGETS.length - 1)];
}

/** Does this dart count for the Around the Clock target? */
export function atcHit(d: Dart, target: number, ring: 'single' | 'double' | 'treble'): boolean {
  if (target === 25) return ring === 'single' ? isBull(d) : d === 'D25';
  if (dartNum(d) !== target) return false;
  if (ring === 'single') return true;
  return d[0] === (ring === 'double' ? 'D' : 'T');
}

export function seqApply(s: SeqState, ev: GameEvent, eventIdx: number): void {
  if (ev.t === 'end') {
    if (s.phase !== 'over') {
      s.phase = 'over';
      s.ended = ev.reason;
    }
    return;
  }
  if (s.phase !== 'play') return;
  const p = s.current;
  const pl = s.players[p];
  const c = s.config;
  if (ev.t === 'dart' && c.kind === 'atc') {
    const startIdx = pl.idx;
    s.visitDarts.push(ev.d);
    pl.darts++;
    if (atcHit(ev.d, seqTarget(s, p), c.ring)) {
      pl.hits++;
      pl.idx++;
      if (pl.idx >= SEQUENCE_TARGETS.length) {
        pl.done = true;
        pl.finishedIn = pl.darts;
      }
    }
    if (pl.done || s.visitDarts.length === 3) close(s, eventIdx, ev.ts, startIdx);
    return;
  }
  if (ev.t === 'res' && c.kind === 'frustration') {
    const startIdx = pl.idx;
    pl.visits++;
    pl.darts += 3;
    if (ev.v >= 1) pl.ext.reached80 = (pl.ext.reached80 ?? 0) + 1;
    if (ev.v === 2) {
      pl.hits++;
      pl.idx++;
      if (pl.idx >= SEQUENCE_TARGETS.length) {
        pl.done = true;
        pl.finishedIn = pl.visits;
      }
    }
    close(s, eventIdx, ev.ts, startIdx, ev.v);
  }
}

function close(s: SeqState, eventIdx: number, ts: number, startIdx: number, res?: number) {
  const p = s.current;
  const pl = s.players[p];
  pl.visits += s.config.kind === 'atc' ? 1 : 0;
  s.visits.push({
    seat: p,
    leg: 0,
    round: pl.visits,
    start: SEQUENCE_TARGETS[Math.min(startIdx, 20)],
    total: pl.idx - startIdx,
    darts: s.visitDarts.length ? [...s.visitDarts] : undefined,
    used: s.visitDarts.length || 3,
    atF: 0,
    bust: false,
    checkout: pl.done,
    ts,
    marks: res ?? pl.idx - startIdx,
  });
  s.visitDarts = [];
  s.lastClosed = { visitIdx: s.visits.length - 1, eventIdx };
  for (let k = 1; k <= s.seats; k++) {
    const q = (p + k) % s.seats;
    if (!s.players[q].done) {
      s.current = q;
      return;
    }
  }
  s.phase = 'over';
  if (s.seats > 1) {
    const best = Math.min(...s.players.map((x) => x.finishedIn ?? Infinity));
    const leaders = s.players.flatMap((x, i) => (x.finishedIn === best ? [i] : []));
    s.winner = leaders.length === 1 ? leaders[0] : null;
  }
}

export function summarizeSeq(s: SeqState): StatRow[] {
  return s.players.map((pl, seat) => ({
    seat,
    won: s.winner === seat,
    m: {
      score: pl.finishedIn ?? 0,
      reached: pl.idx,
      darts: pl.darts,
      visits: pl.visits,
      hits: pl.hits,
      complete: pl.done ? 1 : 0,
      ...pl.ext,
    },
  }));
}
