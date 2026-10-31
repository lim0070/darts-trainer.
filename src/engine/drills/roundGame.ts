import { type Dart, dartMult, dartNum, isBull } from '../darts';
import { dartValue } from '../rules';
import type { StatRow } from '../stats';
import type { GameEvent, PendingPunish, Phase, RoundDrillConfig, RoundTarget, VisitRecord } from '../types';

// One engine for every "N rounds at a target, add up the points" drill:
// Count-Up, Eagle's Eye, Cricket Count-Up, Half-It, Shoot Out, Shanghai,
// JDC Challenge, Bob's 27 and the scoring drills.

export type RoundRule = 'plain' | 'shanghai' | 'jdcDouble' | 'jdcBull';

export interface RoundSpec {
  target: RoundTarget;
  darts: number;
  label: string;
  rule: RoundRule;
}

export interface RoundPlayer {
  score: number;
  done: boolean;
  eliminated: boolean;
  roundsPlayed: number;
  hits: number;
  darts: number;
  /** Drill-specific counters (inner bulls, trebles, marks, shanghais, visits over a threshold…). */
  ext: Record<string, number>;
  /** Shoot Out: areas already hit (1–20, 25). */
  opened: number[];
}

export interface RoundState {
  kind: RoundDrillConfig['kind'];
  config: RoundDrillConfig;
  seats: number;
  rounds: RoundSpec[];
  players: RoundPlayer[];
  roundIdx: number;
  current: number;
  visitDarts: Dart[];
  visitStartScore: number;
  visits: VisitRecord[];
  phase: Phase;
  winner: number | null;
  pendingPunish: PendingPunish | null;
  lastClosed: { visitIdx: number; eventIdx: number } | null;
  ended: 'timeUp' | 'stopped' | null;
}

const CRICKET_ORDER = [20, 19, 18, 17, 16, 15];

export const HALF_IT_DEFAULT: RoundTarget[] = [
  { k: 'num', n: 15 },
  { k: 'num', n: 16 },
  { k: 'anyDouble' },
  { k: 'num', n: 17 },
  { k: 'num', n: 18 },
  { k: 'anyTreble' },
  { k: 'num', n: 19 },
  { k: 'num', n: 20 },
  { k: 'bull' },
];

export function targetLabel(t: RoundTarget): string {
  switch (t.k) {
    case 'any':
      return 'Any';
    case 'num':
      return String(t.n);
    case 'bull':
      return 'Bull';
    case 'double':
      return t.n === 25 ? 'Bull' : `D${t.n}`;
    case 'anyDouble':
      return 'Any double';
    case 'anyTreble':
      return 'Any treble';
  }
}

const spec = (target: RoundTarget, darts = 3, rule: RoundRule = 'plain', label?: string): RoundSpec => ({
  target,
  darts,
  rule,
  label: label ?? targetLabel(target),
});

export function buildRounds(c: RoundDrillConfig): RoundSpec[] {
  switch (c.kind) {
    case 'countup':
      return Array.from({ length: c.rounds }, () => spec({ k: 'any' }));
    case 'eagleseye':
      return Array.from({ length: c.rounds }, () => spec({ k: 'bull' }));
    case 'cricketcountup':
      return [...CRICKET_ORDER.map((n) => spec({ k: 'num', n })), spec({ k: 'bull' })];
    case 'halfit':
      return c.targets.map((t) => spec(t));
    case 'shootout':
      return Array.from({ length: c.rounds }, () => spec({ k: 'any' }));
    case 'shanghai':
      return Array.from({ length: c.to }, (_, i) => spec({ k: 'num', n: i + 1 }, 3, 'shanghai'));
    case 'jdc':
      return [
        ...[10, 11, 12, 13, 14, 15].map((n) => spec({ k: 'num', n }, 3, 'shanghai')),
        ...Array.from({ length: 20 }, (_, i) => spec({ k: 'double', n: i + 1 }, 1, 'jdcDouble')),
        spec({ k: 'double', n: 25 }, 1, 'jdcBull'),
        ...[15, 16, 17, 18, 19, 20].map((n) => spec({ k: 'num', n }, 3, 'shanghai')),
      ];
    case 'bobs27': {
      const r = Array.from({ length: 20 }, (_, i) => spec({ k: 'double', n: i + 1 }));
      if (c.bull) r.push(spec({ k: 'bull' }));
      return r;
    }
    case 'scoring': {
      const target: RoundTarget = c.target === 'any' ? { k: 'any' } : c.target === 25 ? { k: 'bull' } : { k: 'num', n: c.target };
      const n = Math.max(1, Math.ceil(c.darts / 3));
      return Array.from({ length: n }, (_, i) => spec(target, i === n - 1 ? c.darts - 3 * (n - 1) : 3));
    }
  }
}

function startScore(c: RoundDrillConfig): number {
  if (c.kind === 'halfit') return c.start;
  if (c.kind === 'bobs27') return 27;
  return 0;
}

/** Drills that accept a whole-visit total from the keypad. */
export function acceptsTotals(c: RoundDrillConfig): boolean {
  return (c.kind === 'countup' || (c.kind === 'scoring' && c.target === 'any')) && c.entry === 'total';
}

export function roundInit(config: RoundDrillConfig, seats: number): RoundState {
  return {
    kind: config.kind,
    config,
    seats,
    rounds: buildRounds(config),
    players: Array.from({ length: seats }, () => ({
      score: startScore(config),
      done: false,
      eliminated: false,
      roundsPlayed: 0,
      hits: 0,
      darts: 0,
      ext: {},
      opened: [],
    })),
    roundIdx: 0,
    current: 0,
    visitDarts: [],
    visitStartScore: startScore(config),
    visits: [],
    phase: 'play',
    winner: null,
    pendingPunish: null,
    lastClosed: null,
    ended: null,
  };
}

const bump = (pl: RoundPlayer, k: string, by = 1) => {
  pl.ext[k] = (pl.ext[k] ?? 0) + by;
};

/** Points for one dart and whether it hit the round's target. */
function scoreDart(s: RoundState, pl: RoundPlayer, sp: RoundSpec, d: Dart): { pts: number; hit: boolean } {
  const c = s.config;
  const n = dartNum(d);
  const m = dartMult(d);
  switch (c.kind) {
    case 'countup':
      return { pts: dartValue(d, c.bull), hit: d !== 'M' };
    case 'eagleseye':
      if (d === 'D25') bump(pl, 'inner');
      return { pts: d === 'D25' ? 50 : d === 'S25' ? 25 : 0, hit: isBull(d) };
    case 'cricketcountup': {
      const t = sp.target.k === 'num' ? sp.target.n : 25;
      if (n !== t) return { pts: 0, hit: false };
      bump(pl, 'marks', m);
      return { pts: t === 25 ? (d === 'D25' ? 50 : 25) : m * n, hit: true };
    }
    case 'halfit': {
      const t = sp.target;
      const hit =
        (t.k === 'num' && n === t.n) ||
        (t.k === 'bull' && isBull(d)) ||
        (t.k === 'anyDouble' && d[0] === 'D') ||
        (t.k === 'anyTreble' && d[0] === 'T');
      return { pts: hit ? dartValue(d, c.bull) : 0, hit };
    }
    case 'shootout': {
      if (d === 'M') return { pts: 0, hit: false };
      if (pl.opened.length >= 21) {
        // Bull Challenge once every area is open.
        if (!isBull(d)) return { pts: 0, hit: false };
        bump(pl, 'bullChallenge');
        return { pts: dartValue(d, c.bull) * 21, hit: true };
      }
      if (pl.opened.includes(n)) return { pts: 0, hit: false };
      pl.opened.push(n);
      return { pts: n * pl.opened.length, hit: true };
    }
    case 'shanghai':
    case 'jdc': {
      if (sp.rule === 'jdcDouble') {
        const hit = sp.target.k === 'double' && d === `D${sp.target.n}`;
        return { pts: hit ? 50 : 0, hit };
      }
      if (sp.rule === 'jdcBull') return { pts: d === 'D25' ? 100 : 0, hit: d === 'D25' };
      const t = sp.target.k === 'num' ? sp.target.n : 0;
      return n === t ? { pts: m * n, hit: true } : { pts: 0, hit: false };
    }
    case 'bobs27': {
      if (sp.target.k === 'bull') return { pts: d === 'D25' ? 50 : d === 'S25' ? 25 : 0, hit: isBull(d) };
      const n2 = sp.target.k === 'double' ? sp.target.n : 0;
      const hit = n2 > 0 && d === `D${n2}`;
      return { pts: hit ? n2 * 2 : 0, hit };
    }
    case 'scoring': {
      if (c.target === 'any') return { pts: dartValue(d, c.bull), hit: d !== 'M' };
      if (c.target === 25) {
        if (d === 'D25') bump(pl, 'inner');
        return { pts: isBull(d) ? dartValue(d, c.bull) : 0, hit: isBull(d) };
      }
      if (n !== c.target) return { pts: 0, hit: false };
      if (m === 3) bump(pl, 'trebles');
      return { pts: dartValue(d, c.bull), hit: true };
    }
  }
}

/** Score changes made at the end of a visit (halving, penalties, Shanghai bonus). */
function endVisit(s: RoundState, pl: RoundPlayer, sp: RoundSpec, hits: number): { instantWin: boolean } {
  const c = s.config;
  if (c.kind === 'halfit' && hits === 0) pl.score = Math.floor(pl.score / 2);
  if (c.kind === 'bobs27' && hits === 0) {
    pl.score -= sp.target.k === 'bull' ? 50 : sp.target.k === 'double' ? sp.target.n * 2 : 0;
  }
  if (c.kind === 'bobs27' && pl.score <= 0 && !c.continueBelowZero) {
    pl.eliminated = true;
    pl.done = true;
  }
  if (sp.rule === 'shanghai' && sp.target.k === 'num') {
    const t = sp.target.n;
    const set = new Set(s.visitDarts.filter((d) => dartNum(d) === t).map((d) => dartMult(d)));
    if (set.has(1) && set.has(2) && set.has(3)) {
      bump(pl, 'shanghais');
      if (c.kind === 'shanghai' && s.seats > 1) return { instantWin: true };
      pl.score += c.kind === 'shanghai' ? c.bonus : 100;
    }
  }
  if (c.kind === 'scoring' && c.threshold !== null) {
    if (pl.score - s.visitStartScore >= c.threshold) bump(pl, 'over');
  }
  return { instantWin: false };
}

export function roundApply(s: RoundState, ev: GameEvent, eventIdx: number): void {
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
  const sp = s.rounds[s.roundIdx];
  if (ev.t === 'dart') {
    if (s.visitDarts.length === 0) s.visitStartScore = pl.score;
    s.visitDarts.push(ev.d);
    const r = scoreDart(s, pl, sp, ev.d);
    pl.score += r.pts;
    pl.darts++;
    if (r.hit) pl.hits++;
    if (s.visitDarts.length >= sp.darts) closeVisit(s, eventIdx, ev.ts);
    return;
  }
  if (ev.t === 'visit' && s.visitDarts.length === 0 && acceptsTotals(s.config)) {
    s.visitStartScore = pl.score;
    pl.score += ev.total;
    pl.darts += sp.darts;
    closeVisit(s, eventIdx, ev.ts);
  }
}

function closeVisit(s: RoundState, eventIdx: number, ts: number) {
  const p = s.current;
  const pl = s.players[p];
  const sp = s.rounds[s.roundIdx];
  const darts = s.visitDarts;
  const hits = darts.length
    ? darts.filter((d) => isHitForCount(s, sp, d)).length
    : s.config.kind === 'countup' || s.config.kind === 'scoring'
      ? sp.darts
      : 0;
  const { instantWin } = endVisit(s, pl, sp, hits);
  pl.roundsPlayed++;
  s.visits.push({
    seat: p,
    leg: 0,
    round: s.roundIdx + 1,
    start: s.visitStartScore,
    total: pl.score - s.visitStartScore,
    darts: darts.length ? [...darts] : undefined,
    used: darts.length || sp.darts,
    atF: 0,
    bust: false,
    checkout: false,
    ts,
    marks: hits,
  });
  s.visitDarts = [];
  s.lastClosed = { visitIdx: s.visits.length - 1, eventIdx };
  if (instantWin) {
    s.phase = 'over';
    s.winner = p;
    return;
  }
  advance(s);
}

/** Re-check a dart against the round target without changing state (for visit hit counts). */
function isHitForCount(s: RoundState, sp: RoundSpec, d: Dart): boolean {
  const c = s.config;
  const n = dartNum(d);
  switch (c.kind) {
    case 'countup':
      return d !== 'M';
    case 'shootout':
      return d !== 'M';
    case 'eagleseye':
      return isBull(d);
    case 'scoring':
      if (c.target === 'any') return d !== 'M';
      return c.target === 25 ? isBull(d) : n === c.target;
    default: {
      const t = sp.target;
      if (t.k === 'num') return n === t.n;
      if (t.k === 'bull') return isBull(d);
      if (t.k === 'double') return t.n === 25 ? d === 'D25' : d === `D${t.n}`;
      if (t.k === 'anyDouble') return d[0] === 'D';
      if (t.k === 'anyTreble') return d[0] === 'T';
      return d !== 'M';
    }
  }
}

function advance(s: RoundState) {
  if (s.roundIdx === s.rounds.length - 1) s.players[s.current].done = true;
  for (let q = s.current + 1; q < s.seats; q++) {
    if (!s.players[q].done) {
      s.current = q;
      return;
    }
  }
  s.roundIdx++;
  if (s.roundIdx >= s.rounds.length) {
    finish(s);
    return;
  }
  for (let q = 0; q < s.seats; q++) {
    if (!s.players[q].done) {
      s.current = q;
      return;
    }
  }
  finish(s);
}

function finish(s: RoundState) {
  s.phase = 'over';
  s.players.forEach((p) => (p.done = true));
  if (s.seats > 1) {
    const best = Math.max(...s.players.map((p) => p.score));
    const leaders = s.players.flatMap((p, i) => (p.score === best ? [i] : []));
    s.winner = leaders.length === 1 ? leaders[0] : null;
  }
}

export function summarizeRound(s: RoundState): StatRow[] {
  return s.players.map((pl, seat) => ({
    seat,
    won: s.winner === seat,
    m: {
      score: pl.score,
      rounds: pl.roundsPlayed,
      darts: pl.darts,
      hits: pl.hits,
      complete: s.ended ? 0 : 1,
      ...pl.ext,
    },
  }));
}
