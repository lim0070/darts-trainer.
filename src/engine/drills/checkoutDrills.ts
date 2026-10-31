import type { Dart } from '../darts';
import type { BullMode, OutMode, ThrowRules } from '../rules';
import type { StatRow } from '../stats';
import { canFinish } from '../tables';
import type { CheckoutDrillConfig, GameEvent, PendingPunish, Phase, VisitRecord } from '../types';
import { simulateVisit } from '../visitEntry';

// Attempt-based finishing drills: 121 ladder (with Safehouse), Finish Trainer,
// Catch 40, 170 practice and a fixed checkout list. Each attempt is a mini 01 leg
// from the target with a dart limit.

export interface Attempt {
  target: number;
  darts: number;
  success: boolean | null;
  points: number;
}

export interface CheckoutState {
  kind: CheckoutDrillConfig['kind'];
  config: CheckoutDrillConfig;
  seats: 1;
  current: 0;
  attempts: Attempt[];
  remaining: number;
  visitDarts: Dart[];
  visitStartRem: number;
  visits: VisitRecord[];
  phase: Phase;
  /** Finish Trainer waits for the app to pick a random target. */
  needTarget: boolean;
  winner: null;
  pendingPunish: PendingPunish | null;
  lastClosed: { visitIdx: number; eventIdx: number } | null;
  ended: 'timeUp' | 'stopped' | null;
  ladder: { safe: number | null; streak: number; bestStreak: number; best: number };
}

export function drillRules(c: CheckoutDrillConfig): ThrowRules {
  const out: OutMode = c.kind === 'catch40' || c.kind === 'p170' ? 'double' : c.outMode;
  return { inMode: 'open', outMode: out, bull: c.bull as BullMode };
}

export function dartLimit(c: CheckoutDrillConfig): number {
  switch (c.kind) {
    case 'catch40':
      return 6;
    case 'p170':
      return 3;
    default:
      return c.darts;
  }
}

function totalAttempts(c: CheckoutDrillConfig): number | null {
  switch (c.kind) {
    case 'ladder121':
      return c.rounds;
    case 'finish':
      return c.attempts;
    case 'catch40':
      return 40;
    case 'p170':
      return c.attempts;
    case 'checklist':
      return c.targets.length;
  }
}

export function checkoutInit(config: CheckoutDrillConfig): CheckoutState {
  const s: CheckoutState = {
    kind: config.kind,
    config,
    seats: 1,
    current: 0,
    attempts: [],
    remaining: 0,
    visitDarts: [],
    visitStartRem: 0,
    visits: [],
    phase: 'play',
    needTarget: false,
    winner: null,
    pendingPunish: null,
    lastClosed: null,
    ended: null,
    ladder: { safe: null, streak: 0, bestStreak: 0, best: 0 },
  };
  nextAttempt(s);
  return s;
}

/** Targets the Finish Trainer may pick: in range and finishable within the dart limit. */
export function finishTargets(c: CheckoutDrillConfig): number[] {
  if (c.kind !== 'finish') return [];
  const r = drillRules(c);
  const out: number[] = [];
  for (let t = c.min; t <= c.max; t++) if (canFinish(t, Math.min(3, c.darts), r.outMode, r.bull)) out.push(t);
  return out;
}

function nextTarget(s: CheckoutState): number | null {
  const c = s.config;
  const n = s.attempts.length;
  switch (c.kind) {
    case 'ladder121': {
      const last = s.attempts[n - 1];
      if (!last) return c.start;
      if (last.success) return Math.min(170, last.target + c.step);
      return s.ladder.safe ?? c.start;
    }
    case 'catch40':
      return 61 + n;
    case 'p170':
      return 170;
    case 'checklist':
      return c.targets[n];
    case 'finish':
      return null;
  }
}

function nextAttempt(s: CheckoutState) {
  const limit = totalAttempts(s.config);
  if (limit !== null && s.attempts.length >= limit) {
    s.phase = 'over';
    return;
  }
  const t = nextTarget(s);
  if (t === null) {
    s.needTarget = true;
    return;
  }
  startAttempt(s, t);
}

function startAttempt(s: CheckoutState, target: number) {
  s.needTarget = false;
  s.attempts.push({ target, darts: 0, success: null, points: 0 });
  s.remaining = target;
  s.visitDarts = [];
}

export function currentAttempt(s: CheckoutState): Attempt | undefined {
  return s.attempts[s.attempts.length - 1];
}

export function checkoutApply(s: CheckoutState, ev: GameEvent, eventIdx: number): void {
  if (ev.t === 'end') {
    if (s.phase !== 'over') {
      s.phase = 'over';
      s.ended = ev.reason;
      const a = currentAttempt(s);
      if (a && a.success === null) s.attempts.pop();
    }
    return;
  }
  if (ev.t === 'target') {
    if (s.phase === 'play' && s.needTarget) startAttempt(s, ev.value);
    return;
  }
  if (ev.t === 'punish') {
    s.pendingPunish = { seat: 0, trigger: ev.trigger, card: ev.card };
    return;
  }
  if (ev.t === 'punishDone') {
    s.pendingPunish = null;
    return;
  }
  if (s.phase !== 'play' || s.needTarget || s.pendingPunish) return;
  const a = currentAttempt(s);
  if (!a || a.success !== null) return;
  const rules = drillRules(s.config);
  if (ev.t === 'dart') {
    if (s.visitDarts.length === 0) s.visitStartRem = s.remaining;
    s.visitDarts.push(ev.d);
    const sim = simulateVisit(s.visitStartRem, true, s.visitDarts, rules);
    if (sim.bust || sim.checkout || s.visitDarts.length === 3) {
      const used = sim.bust ? 3 : sim.used;
      s.remaining = sim.bust ? s.visitStartRem : sim.remaining;
      record(s, eventIdx, ev.ts, {
        start: s.visitStartRem,
        total: sim.bust ? 0 : sim.points,
        darts: [...s.visitDarts],
        used,
        atF: sim.atFinish,
        bust: sim.bust,
        checkout: sim.checkout,
      });
    } else {
      s.remaining = sim.remaining;
    }
    return;
  }
  if (ev.t === 'visit' && s.visitDarts.length === 0) {
    const start = s.remaining;
    const bust = !!ev.bust;
    const total = bust ? 0 : ev.total;
    const checkout = !bust && start - total === 0;
    if (!bust) s.remaining = start - total;
    record(s, eventIdx, ev.ts, {
      start,
      total,
      used: checkout ? (ev.used ?? 3) : 3,
      atF: ev.atF ?? 0,
      bust,
      checkout,
    });
  }
}

function record(
  s: CheckoutState,
  eventIdx: number,
  ts: number,
  v: Pick<VisitRecord, 'start' | 'total' | 'used' | 'atF' | 'bust' | 'checkout'> & { darts?: Dart[] },
) {
  const a = currentAttempt(s)!;
  a.darts += v.used;
  s.visits.push({ seat: 0, leg: s.attempts.length - 1, round: 0, ts, ...v });
  s.visits[s.visits.length - 1].round = s.visits.filter((x) => x.leg === s.attempts.length - 1).length;
  s.visitDarts = [];
  s.lastClosed = { visitIdx: s.visits.length - 1, eventIdx };
  if (v.checkout) endAttempt(s, true);
  else if (a.darts >= dartLimit(s.config)) endAttempt(s, false);
}

function endAttempt(s: CheckoutState, success: boolean) {
  const a = currentAttempt(s)!;
  a.success = success;
  const c = s.config;
  if (c.kind === 'catch40' && success) {
    a.points = a.darts <= 2 ? 3 : a.darts === 3 ? (a.target === 99 ? 3 : 2) : 1;
  } else if (success) {
    a.points = 1;
  }
  if (c.kind === 'ladder121') {
    const L = s.ladder;
    if (success) {
      L.streak++;
      L.bestStreak = Math.max(L.bestStreak, L.streak);
      L.best = Math.max(L.best, a.target);
      const protect =
        c.safehouse === 'each' ||
        (c.safehouse === 'three' && a.darts <= 3) ||
        (c.safehouse === 'six' && a.darts <= 6) ||
        (c.safehouse === 'row3' && L.streak >= 3) ||
        (c.safehouse === 'row5' && L.streak >= 5);
      if (protect) L.safe = a.target;
    } else {
      L.streak = 0;
    }
  }
  nextAttempt(s);
}

export function summarizeCheckout(s: CheckoutState): StatRow[] {
  const done = s.attempts.filter((a) => a.success !== null);
  const ok = done.filter((a) => a.success);
  const m: Record<string, number> = {
    attempts: done.length,
    success: ok.length,
    successDarts: ok.reduce((t, a) => t + a.darts, 0),
    points: done.reduce((t, a) => t + a.points, 0),
    darts: done.reduce((t, a) => t + a.darts, 0),
    complete: s.ended ? 0 : 1,
  };
  if (s.config.kind === 'ladder121') {
    m.best = s.ladder.best;
    m.bestStreak = s.ladder.bestStreak;
  }
  if (s.config.kind === 'p170') {
    const darts = s.visits.flatMap((v) => v.darts ?? []);
    m.t20 = darts.filter((d) => d === 'T20').length;
    m.bulls = darts.filter((d) => d === 'D25' || d === 'S25').length;
    m.dartsThrown = darts.length;
  }
  return [{ seat: 0, won: false, m }];
}
