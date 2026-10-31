import { describe, expect, it } from 'vitest';
import type { Dart } from './darts';
import { ppr, summarizeX01 } from './stats';
import type { GameEvent, X01Config } from './types';
import { currentLeg, x01Apply, x01Init, type X01State } from './x01';

const punish = { on: false, bust: true, missedCheckout: true, lowScoreBelow: 26, surprisePct: 0 };

function cfg(over: Partial<X01Config> = {}): X01Config {
  return {
    kind: 'x01',
    preset: 'soft',
    start: 301,
    inMode: 'open',
    outMode: 'open',
    bull: 'fat',
    roundLimit: 15,
    legsToWin: 1,
    setsToWin: null,
    entry: 'total',
    punish,
    timedMinutes: null,
    ...over,
  };
}

function play(c: X01Config, seats: number, events: GameEvent[]): X01State {
  const s = x01Init(c, seats);
  events.forEach((e, i) => x01Apply(s, e, i));
  return s;
}

let t = 0;
const visit = (total: number, extra: Partial<{ bust: true; used: number; atF: number }> = {}): GameEvent => ({
  ts: (t += 1000),
  t: 'visit',
  total,
  ...extra,
});
const dart = (d: Dart): GameEvent => ({ ts: (t += 1000), t: 'dart', d });

describe('01 match flow', () => {
  it('plays a solo soft-tip leg by keypad', () => {
    const s = play(cfg(), 1, [visit(180), visit(81), visit(40, { used: 1, atF: 1 })]);
    expect(s.phase).toBe('over');
    expect(s.legs[0]).toMatchObject({ winner: 0, complete: true });
    const [row] = summarizeX01(s);
    expect(row.m).toMatchObject({ pts: 301, darts: 7, co: 1, hico: 40, best: 7, b180: 1, b60: 1 });
    expect(ppr(row.m.pts, row.m.darts)).toBeCloseTo(129, 0);
  });

  it('handles busts dart by dart under double-out', () => {
    const steel = cfg({ preset: 'steel', start: 501, outMode: 'double', bull: 'separate', roundLimit: null });
    const s = play(steel, 2, [dart('T20'), dart('T20'), dart('T20'), dart('T20'), dart('T20'), dart('T20')]);
    expect(s.remaining).toEqual([321, 321]);
    expect(s.current).toBe(0);
    expect(s.round).toBe(2);
    // From 32, a treble 20 busts and the visit ends at once.
    const s2 = x01Init(steel, 1);
    s2.remaining[0] = 32;
    x01Apply(s2, dart('S16'), 0);
    expect(s2.remaining[0]).toBe(16);
    x01Apply(s2, dart('T20'), 1);
    expect(s2.remaining[0]).toBe(32);
    expect(s2.visits[0]).toMatchObject({ bust: true, used: 3, total: 0, start: 32 });
    expect(s2.visitDarts).toEqual([]);
  });

  it('alternates who throws first and finishes a first-to-2 match', () => {
    const c = cfg({ start: 101, roundLimit: null, legsToWin: 2 });
    const s = play(c, 2, [
      visit(101, { used: 3 }), // leg 1: seat 0 starts and wins
      visit(60),
      visit(101, { used: 3 }), // leg 2: seat 1 starts, then seat 0 checks out
    ]);
    expect(s.legs.map((l) => l.starter)).toEqual([0, 1]);
    expect(s.legs.map((l) => l.winner)).toEqual([0, 0]);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
  });

  it('rotates the starter across sets', () => {
    const c = cfg({ start: 101, roundLimit: null, legsToWin: 2, setsToWin: 2 });
    const evs: GameEvent[] = [];
    // Seat 0 wins every leg in one visit: starters should follow (set + leg) % 2.
    const s = x01Init(c, 2);
    let i = 0;
    while (s.phase !== 'over' && i < 50) {
      const ev = s.current === 0 ? visit(101, { used: 3 }) : visit(0);
      evs.push(ev);
      x01Apply(s, ev, i++);
    }
    expect(s.legs.map((l) => `${l.set}:${l.starter}`)).toEqual(['0:0', '0:1', '1:1', '1:0']);
    expect(s.setsWon).toEqual([2, 0]);
    expect(s.winner).toBe(0);
  });

  it('goes to a cork when the round limit passes without a finish', () => {
    const s = play(cfg({ roundLimit: 1 }), 2, [visit(60), visit(100)]);
    expect(s.phase).toBe('cork');
    x01Apply(s, { ts: 1, t: 'cork', winner: 1 }, 2);
    expect(s.legs[0]).toMatchObject({ winner: 1, byCork: true });
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(1);
  });

  it('ends a solo leg unfinished at the round limit', () => {
    const s = play(cfg({ roundLimit: 2 }), 1, [visit(60), visit(60)]);
    expect(s.phase).toBe('over');
    expect(s.legs[0]).toMatchObject({ winner: null, complete: true });
  });

  it('keeps playing legs until time is up in Speed 501', () => {
    const c = cfg({ start: 101, roundLimit: null, timedMinutes: 5 });
    const s = play(c, 1, [visit(101, { used: 3 }), visit(60), { ts: (t += 1000), t: 'end', reason: 'timeUp' }]);
    expect(s.phase).toBe('over');
    expect(s.legs).toHaveLength(2);
    expect(currentLeg(s).complete).toBe(false);
    const [row] = summarizeX01(s);
    expect(row.m.legs).toBe(1);
    expect(row.m.pts).toBe(101);
  });

  it('blocks throws while a punishment card is open', () => {
    const s = play(cfg(), 1, [
      visit(20),
      { ts: 1, t: 'punish', seat: 0, trigger: 'lowScore', card: { cardId: 'pushups', text: 'Do 10 push-ups', reps: 10 } },
      visit(60),
    ]);
    expect(s.visits).toHaveLength(1);
    x01Apply(s, { ts: 2, t: 'punishDone', outcome: 'done' }, 3);
    x01Apply(s, visit(60), 4);
    expect(s.visits).toHaveLength(2);
  });

  it('only scores after getting in under double-in', () => {
    const c = cfg({ inMode: 'double', outMode: 'double', bull: 'separate', roundLimit: null, start: 501 });
    const s = play(c, 1, [visit(0), visit(40)]);
    expect(s.isIn[0]).toBe(true);
    expect(s.remaining[0]).toBe(461);
    const d = play(c, 1, [dart('T20'), dart('D20'), dart('T20')]);
    expect(d.remaining[0]).toBe(401);
  });

  it('computes first-9 and 80% stats', () => {
    const c = cfg({ start: 501, roundLimit: null });
    const s = play(c, 1, [visit(100), visit(100), visit(100), visit(100), visit(101, { used: 2 })]);
    const [row] = summarizeX01(s);
    expect(row.m).toMatchObject({ f9pts: 300, f9darts: 9, p80rounds: 5, p80pts: 501, darts: 14, b100: 5 });
  });
});
