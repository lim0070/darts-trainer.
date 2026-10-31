import { describe, expect, it } from 'vitest';
import type { Dart } from '../darts';
import { getNeed, reduce, summarize, undoCut } from '../reduce';
import type { DrillConfig, GameEvent } from '../types';
import { HALF_IT_DEFAULT, type RoundState } from './roundGame';
import type { SeqState } from './sequence';
import type { CheckoutState } from './checkoutDrills';

let t = 0;
const d = (x: Dart): GameEvent => ({ ts: (t += 100), t: 'dart', d: x });
const darts = (...xs: Dart[]) => xs.map(d);
const rep = <T>(n: number, xs: T[]) => Array.from({ length: n }, () => xs).flat();
const visit = (total: number, o: { used?: number; bust?: true } = {}): GameEvent => ({ ts: (t += 100), t: 'visit', total, ...o });

const round = (c: DrillConfig, seats: number, evs: GameEvent[]) => reduce(c, seats, evs) as RoundState;

describe('round drills', () => {
  it('Count-Up maxes at 1440 and scores the fat bull as 50', () => {
    const c: DrillConfig = { kind: 'countup', rounds: 8, bull: 'fat', entry: 'darts' };
    expect(round(c, 1, darts(...rep(8, ['T20', 'T20', 'T20'] as Dart[]))).players[0].score).toBe(1440);
    const s = round(c, 1, darts('S25', 'D25', 'M'));
    expect(s.players[0].score).toBe(100);
    const keyed = round({ ...c, entry: 'total' }, 1, [visit(60), visit(100)]);
    expect(keyed.players[0].score).toBe(160);
    expect(keyed.roundIdx).toBe(2);
  });

  it("Eagle's Eye maxes at 1200", () => {
    const s = round({ kind: 'eagleseye', rounds: 8 }, 1, darts(...rep(8, ['D25', 'D25', 'D25'] as Dart[])));
    expect(s.players[0].score).toBe(1200);
    expect(s.phase).toBe('over');
    expect(summarize(s)[0].m).toMatchObject({ score: 1200, inner: 24, hits: 24 });
  });

  it('Cricket Count-Up scores only the round target and counts marks', () => {
    const evs = darts(...[20, 19, 18, 17, 16, 15].flatMap((n) => rep(3, [`T${n}` as Dart])), 'D25', 'D25', 'D25');
    const s = round({ kind: 'cricketcountup' }, 1, evs);
    expect(s.players[0].score).toBe(9 * 105 + 150);
    expect(s.players[0].ext.marks).toBe(60);
    const off = round({ kind: 'cricketcountup' }, 1, darts('T19', 'S20', 'M'));
    expect(off.players[0].score).toBe(20);
  });

  it('Half-It halves the score after a round with no hits', () => {
    const c: DrillConfig = { kind: 'halfit', start: 40, targets: HALF_IT_DEFAULT, bull: 'fat' };
    const s = round(c, 1, darts('M', 'S14', 'T20', 'S16', 'D16', 'M'));
    expect(s.players[0].score).toBe(20 + 16 + 32);
  });

  it('Shoot Out multiplies by the areas opened and ignores repeats', () => {
    const s = round({ kind: 'shootout', rounds: 8, bull: 'fat' }, 1, darts('S1', 'T2', 'S3', 'S1', 'M', 'S25'));
    expect(s.players[0].score).toBe(1 * 1 + 2 * 2 + 3 * 3 + 25 * 4);
  });

  it('Shanghai gives a bonus solo and an instant win with friends', () => {
    const solo = round({ kind: 'shanghai', to: 7, bonus: 100 }, 1, darts('S1', 'D1', 'T1'));
    expect(solo.players[0].score).toBe(106);
    const duo = round({ kind: 'shanghai', to: 7, bonus: 100 }, 2, darts('S1', 'D1', 'T1'));
    expect(duo.phase).toBe('over');
    expect(duo.winner).toBe(0);
  });

  it('JDC part 2 scores 50 per double and 100 for the bull', () => {
    const part1 = rep(6, ['M', 'M', 'M'] as Dart[]);
    const part2: Dart[] = Array.from({ length: 20 }, (_, i) => (i < 12 ? (`D${i + 1}` as Dart) : 'M'));
    const s = round({ kind: 'jdc' }, 1, darts(...part1, ...part2, 'D25'));
    expect(s.players[0].score).toBe(700);
    expect(s.rounds).toHaveLength(33);
  });

  it("Bob's 27 maxes at 1437 and knocks you out at zero", () => {
    const all = [...Array.from({ length: 20 }, (_, i) => rep(3, [`D${i + 1}` as Dart])).flat(), 'D25', 'D25', 'D25'] as Dart[];
    const best = round({ kind: 'bobs27', bull: true, continueBelowZero: false }, 1, darts(...all));
    expect(best.players[0].score).toBe(1437);
    const bad = round({ kind: 'bobs27', bull: true, continueBelowZero: false }, 1, darts(...rep(15, ['M'] as Dart[])));
    expect(bad.players[0]).toMatchObject({ score: -3, eliminated: true });
    expect(bad.phase).toBe('over');
  });

  it('scoring drills track hits, trebles and visits over a threshold', () => {
    const s = round(
      { kind: 'scoring', target: 20, darts: 6, threshold: null, bull: 'fat', entry: 'darts' },
      1,
      darts('T20', 'S20', 'S1', 'T20', 'T20', 'M'),
    );
    expect(summarize(s)[0].m).toMatchObject({ score: 200, hits: 4, trebles: 3, darts: 6 });
    const ch = round({ kind: 'scoring', target: 'any', darts: 9, threshold: 60, bull: 'fat', entry: 'total' }, 1, [
      visit(60),
      visit(45),
      visit(100),
    ]);
    expect(summarize(ch)[0].m.over).toBe(2);
    const odd = round({ kind: 'scoring', target: 25, darts: 100, threshold: null, bull: 'separate', entry: 'darts' }, 1, []);
    expect(odd.rounds).toHaveLength(34);
    expect(odd.rounds[33].darts).toBe(1);
  });
});

describe('sequence drills', () => {
  it('Around the Clock counts darts to finish', () => {
    const hits = [...Array.from({ length: 20 }, (_, i) => `S${i + 1}` as Dart), 'S25'] as Dart[];
    const s = reduce({ kind: 'atc', ring: 'single' }, 1, darts('M', ...hits)) as SeqState;
    expect(s.phase).toBe('over');
    expect(s.players[0].finishedIn).toBe(22);
    const dbl = reduce({ kind: 'atc', ring: 'double' }, 1, darts('S1', 'D1', 'D2')) as SeqState;
    expect(dbl.players[0].idx).toBe(2);
  });

  it('Frustration needs 80 then the double', () => {
    const evs: GameEvent[] = [{ ts: 1, t: 'res', v: 0 }, { ts: 2, t: 'res', v: 1 }, ...rep(21, [{ ts: 3, t: 'res', v: 2 } as GameEvent])];
    const s = reduce({ kind: 'frustration' }, 1, evs) as SeqState;
    expect(s.players[0].finishedIn).toBe(23);
    expect(s.phase).toBe('over');
  });
});

describe('checkout drills', () => {
  it('follows the 121 Safehouse example', () => {
    const c: DrillConfig = {
      kind: 'ladder121',
      start: 121,
      darts: 9,
      step: 1,
      safehouse: 'three',
      rounds: 10,
      outMode: 'double',
      bull: 'separate',
      entry: 'total',
    };
    const s = reduce(c, 1, [
      visit(60),
      visit(61, { used: 3 }), // 121 in 6 darts
      visit(122, { used: 3 }), // 122 in 3 darts → protected
      visit(0),
      visit(0),
      visit(0), // miss 123
    ]) as CheckoutState;
    expect(s.attempts.map((a) => [a.target, a.success])).toEqual([
      [121, true],
      [122, true],
      [123, false],
      [122, null],
    ]);
    expect(s.ladder).toMatchObject({ safe: 122, best: 122, bestStreak: 2 });
  });

  it('scores Catch 40 by darts used, with the 99 rule', () => {
    const c: DrillConfig = { kind: 'catch40', bull: 'separate', entry: 'total' };
    const s = reduce(c, 1, [visit(61, { used: 2 }), visit(62, { used: 3 }), visit(0), visit(0)]) as CheckoutState;
    expect(s.attempts.map((a) => a.points)).toEqual([3, 2, 0, 0]);
    expect(s.attempts[3].target).toBe(64);
    const evs: GameEvent[] = [];
    for (let i = 61; i <= 100; i++) evs.push(i === 99 ? visit(99, { used: 3 }) : visit(i, { used: 2 }));
    const max = reduce(c, 1, evs) as CheckoutState;
    expect(max.phase).toBe('over');
    expect(summarize(max)[0].m.points).toBe(120);
  });

  it('waits for a random target in the Finish Trainer', () => {
    const c: DrillConfig = { kind: 'finish', min: 41, max: 170, darts: 6, outMode: 'open', bull: 'fat', attempts: 2, entry: 'total' };
    const s0 = reduce(c, 1, []);
    expect(getNeed(s0, [{ playerId: 'p', name: 'P' }])).toEqual({ k: 'target' });
    const s = reduce(c, 1, [{ ts: 1, t: 'target', value: 100, auto: true }, visit(100, { used: 2 })]) as CheckoutState;
    expect(s.attempts[0]).toMatchObject({ target: 100, success: true });
    expect(s.needTarget).toBe(true);
  });

  it('tracks 170 practice dart by dart', () => {
    const s = reduce({ kind: 'p170', attempts: 1, bull: 'separate', entry: 'darts' }, 1, darts('T20', 'T20', 'D25')) as CheckoutState;
    expect(summarize(s)[0].m).toMatchObject({ success: 1, t20: 2, bulls: 1 });
  });
});

describe('undo', () => {
  it('removes app-made events, a finished card and the last entry', () => {
    const user = (n: number): GameEvent => ({ ts: n, t: 'visit', total: n });
    const auto: GameEvent = { ts: 0, t: 'dart', d: 'T20', auto: true };
    const punish: GameEvent = { ts: 0, t: 'punish', seat: 0, trigger: 'bust', card: { cardId: 'x', text: 'x' }, auto: true };
    const done: GameEvent = { ts: 0, t: 'punishDone', outcome: 'done' };
    expect(undoCut([user(1), user(2)])).toBe(1);
    expect(undoCut([user(1), auto, auto])).toBe(0);
    expect(undoCut([user(1), user(2), punish, done])).toBe(1);
    expect(undoCut([])).toBe(0);
  });
});
