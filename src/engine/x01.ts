import type { Dart } from './darts';
import type { ThrowRules } from './rules';
import type { GameEvent, PendingPunish, Phase, VisitRecord, X01Config } from './types';
import { simulateVisit } from './visitEntry';

export interface X01Leg {
  index: number;
  set: number;
  legInSet: number;
  starter: number;
  winner: number | null;
  byCork: boolean;
  complete: boolean;
  startTs: number | null;
  endTs: number | null;
}

export interface X01State {
  kind: 'x01';
  config: X01Config;
  seats: number;
  legs: X01Leg[];
  visits: VisitRecord[];
  setIdx: number;
  legInSet: number;
  setsWon: number[];
  legsWonInSet: number[];
  legsWonTotal: number[];
  remaining: number[];
  isIn: boolean[];
  current: number;
  round: number;
  visitDarts: Dart[];
  visitStartRem: number;
  visitStartIn: boolean;
  phase: Phase;
  winner: number | null;
  pendingPunish: PendingPunish | null;
  /** The visit closed by the most recent event, for punishment checks and UI feedback. */
  lastClosed: { visitIdx: number; eventIdx: number } | null;
  ended: 'timeUp' | 'stopped' | null;
}

export function x01Rules(c: X01Config): ThrowRules {
  return { inMode: c.inMode, outMode: c.outMode, bull: c.bull };
}

export function x01Init(config: X01Config, seats: number): X01State {
  const s: X01State = {
    kind: 'x01',
    config,
    seats,
    legs: [],
    visits: [],
    setIdx: 0,
    legInSet: 0,
    setsWon: Array(seats).fill(0),
    legsWonInSet: Array(seats).fill(0),
    legsWonTotal: Array(seats).fill(0),
    remaining: Array(seats).fill(config.start),
    isIn: Array(seats).fill(config.inMode === 'open'),
    current: 0,
    round: 1,
    visitDarts: [],
    visitStartRem: config.start,
    visitStartIn: config.inMode === 'open',
    phase: 'play',
    winner: null,
    pendingPunish: null,
    lastClosed: null,
    ended: null,
  };
  startLeg(s);
  return s;
}

function startLeg(s: X01State) {
  const starter = (s.setIdx + s.legInSet) % s.seats;
  s.legs.push({
    index: s.legs.length,
    set: s.setIdx,
    legInSet: s.legInSet,
    starter,
    winner: null,
    byCork: false,
    complete: false,
    startTs: null,
    endTs: null,
  });
  s.remaining = Array(s.seats).fill(s.config.start);
  s.isIn = Array(s.seats).fill(s.config.inMode === 'open');
  s.current = starter;
  s.round = 1;
  s.visitDarts = [];
}

export function currentLeg(s: X01State): X01Leg {
  return s.legs[s.legs.length - 1];
}

function canThrow(s: X01State): boolean {
  return s.phase === 'play' && !s.pendingPunish;
}

export function x01Apply(s: X01State, ev: GameEvent, eventIdx: number): void {
  switch (ev.t) {
    case 'dart': {
      if (!canThrow(s)) return;
      const p = s.current;
      const leg = currentLeg(s);
      leg.startTs ??= ev.ts;
      if (s.visitDarts.length === 0) {
        s.visitStartRem = s.remaining[p];
        s.visitStartIn = s.isIn[p];
      }
      s.visitDarts.push(ev.d);
      const sim = simulateVisit(s.visitStartRem, s.visitStartIn, s.visitDarts, x01Rules(s.config));
      if (sim.bust || sim.checkout || s.visitDarts.length === 3) {
        closeVisit(s, eventIdx, ev.ts, {
          seat: p,
          leg: leg.index,
          round: s.round,
          start: s.visitStartRem,
          total: sim.bust ? 0 : sim.points,
          darts: [...s.visitDarts],
          used: sim.bust ? 3 : sim.used,
          atF: sim.atFinish,
          bust: sim.bust,
          checkout: sim.checkout,
          ts: ev.ts,
        });
        s.remaining[p] = sim.bust ? s.visitStartRem : sim.remaining;
        s.isIn[p] = sim.bust ? s.visitStartIn : sim.isIn;
        afterVisit(s, ev.ts);
      } else {
        s.remaining[p] = sim.remaining;
        s.isIn[p] = sim.isIn;
      }
      return;
    }
    case 'visit': {
      if (!canThrow(s) || s.visitDarts.length > 0) return;
      const p = s.current;
      const leg = currentLeg(s);
      leg.startTs ??= ev.ts;
      const start = s.remaining[p];
      const bust = !!ev.bust;
      const total = bust ? 0 : ev.total;
      const left = start - total;
      const checkout = !bust && left === 0;
      closeVisit(s, eventIdx, ev.ts, {
        seat: p,
        leg: leg.index,
        round: s.round,
        start,
        total,
        used: checkout ? (ev.used ?? 3) : 3,
        atF: ev.atF ?? 0,
        bust,
        checkout,
        ts: ev.ts,
      });
      if (!bust) {
        s.remaining[p] = left;
        if (total > 0) s.isIn[p] = true;
      }
      afterVisit(s, ev.ts);
      return;
    }
    case 'cork': {
      if (s.phase !== 'cork') return;
      s.phase = 'play';
      finishLeg(s, ev.winner, true, ev.ts);
      return;
    }
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

function closeVisit(s: X01State, eventIdx: number, _ts: number, v: VisitRecord) {
  s.visits.push(v);
  s.visitDarts = [];
  s.lastClosed = { visitIdx: s.visits.length - 1, eventIdx };
}

function afterVisit(s: X01State, ts: number) {
  const v = s.visits[s.visits.length - 1];
  if (v.checkout) {
    finishLeg(s, v.seat, false, ts);
    return;
  }
  const leg = currentLeg(s);
  s.current = (s.current + 1) % s.seats;
  if (s.current === leg.starter) {
    const limit = s.config.roundLimit;
    if (limit !== null && s.round >= limit) {
      if (s.seats === 1) finishLeg(s, null, false, ts);
      else s.phase = 'cork';
      return;
    }
    s.round++;
  }
}

function finishLeg(s: X01State, winner: number | null, byCork: boolean, ts: number) {
  const leg = currentLeg(s);
  leg.winner = winner;
  leg.byCork = byCork;
  leg.complete = true;
  leg.endTs = ts;
  const c = s.config;
  if (winner !== null) {
    s.legsWonInSet[winner]++;
    s.legsWonTotal[winner]++;
  }
  if (c.timedMinutes) {
    s.legInSet++;
    startLeg(s);
    return;
  }
  if (s.seats === 1) {
    if (s.legs.length >= c.legsToWin) {
      s.phase = 'over';
      s.winner = null;
      return;
    }
    s.legInSet++;
    startLeg(s);
    return;
  }
  if (winner === null) {
    s.legInSet++;
    startLeg(s);
    return;
  }
  if (c.setsToWin) {
    if (s.legsWonInSet[winner] >= c.legsToWin) {
      s.setsWon[winner]++;
      if (s.setsWon[winner] >= c.setsToWin) {
        s.phase = 'over';
        s.winner = winner;
        return;
      }
      s.legsWonInSet = Array(s.seats).fill(0);
      s.setIdx++;
      s.legInSet = 0;
    } else {
      s.legInSet++;
    }
    startLeg(s);
    return;
  }
  if (s.legsWonTotal[winner] >= c.legsToWin) {
    s.phase = 'over';
    s.winner = winner;
    return;
  }
  s.legInSet++;
  startLeg(s);
}

/** Visits of one seat in one leg, in order. */
export function legVisits(s: { visits: VisitRecord[] }, leg: number, seat: number): VisitRecord[] {
  return s.visits.filter((v) => v.leg === leg && v.seat === seat);
}
