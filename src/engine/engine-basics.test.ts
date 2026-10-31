import { describe, expect, it } from 'vitest';
import { SEGMENT_ORDER, type Dart } from './darts';
import { bestRoute } from './checkout';
import { dartValue, isFinisher, type BullMode, type OutMode } from './rules';
import { bogeyNumbers, impossibleTotals, maxFinish, minDartsToFinish } from './tables';
import { analyzeVisitTotal, applyDart, simulateVisit } from './visitEntry';

const steel = { inMode: 'open', outMode: 'double', bull: 'separate' } as const;
const soft = { inMode: 'open', outMode: 'open', bull: 'fat' } as const;

describe('board and tables', () => {
  it('has every number once in the segment order', () => {
    expect([...SEGMENT_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(SEGMENT_ORDER.indexOf(6)).toBe(5);
    expect(SEGMENT_ORDER.indexOf(3)).toBe(10);
    expect(SEGMENT_ORDER.indexOf(11)).toBe(15);
  });

  it('knows the impossible three-dart totals', () => {
    expect(impossibleTotals('separate')).toEqual([163, 166, 169, 172, 173, 175, 176, 178, 179]);
    expect(impossibleTotals('fat')).toEqual(expect.arrayContaining([163, 166, 169, 172, 173, 175, 176, 178, 179]));
  });

  it('knows double-out bogey numbers and maximum finishes', () => {
    expect(bogeyNumbers('double', 'separate')).toEqual([159, 162, 163, 165, 166, 168, 169]);
    expect(maxFinish('double', 'separate')).toBe(170);
    expect(maxFinish('master', 'separate')).toBe(180);
    expect(maxFinish('open', 'fat')).toBe(180);
    for (const r of [99, 102, 103, 105, 106, 108, 109]) expect(minDartsToFinish(r, 'double', 'separate')).toBe(3);
    for (const r of [100, 101, 104, 107, 110]) expect(minDartsToFinish(r, 'double', 'separate')).toBe(2);
    expect(minDartsToFinish(1, 'double', 'separate')).toBe(Infinity);
    expect(minDartsToFinish(1, 'open', 'fat')).toBe(1);
  });
});

describe('checkout routes', () => {
  const golden = (out: OutMode, bull: BullMode, table: Record<number, string>) => {
    for (const [r, route] of Object.entries(table)) {
      expect(bestRoute(Number(r), 3, out, bull)?.join(' '), `route for ${r}`).toBe(route);
    }
  };

  it('suggests the classic steel double-out routes', () => {
    golden('double', 'separate', {
      170: 'T20 T20 D25',
      167: 'T20 T19 D25',
      160: 'T20 T20 D20',
      141: 'T20 T19 D12',
      110: 'T20 D25',
      100: 'T20 D20',
      90: 'T18 D18',
      81: 'T19 D12',
      72: 'T16 D12',
      61: 'T15 D8',
      60: 'S20 D20',
      50: 'D25',
      40: 'D20',
      3: 'S1 D1',
    });
  });

  it('suggests easy soft-tip open-out routes with fat bull', () => {
    golden('open', 'fat', {
      180: 'T20 T20 T20',
      150: 'D25 D25 D25',
      100: 'D25 D25',
      70: 'D25 S20',
      60: 'T20',
      50: 'D25',
      41: 'S20 T7',
    });
  });

  it('returns valid, shortest routes for every score', () => {
    const combos: [OutMode, BullMode][] = [
      ['double', 'separate'],
      ['double', 'fat'],
      ['master', 'separate'],
      ['master', 'fat'],
      ['open', 'separate'],
      ['open', 'fat'],
    ];
    for (const [out, bull] of combos) {
      const rules = { inMode: 'open', outMode: out, bull } as const;
      for (let r = 1; r <= 181; r++) {
        const min = minDartsToFinish(r, out, bull);
        for (let k = 1; k <= 3; k++) {
          const route = bestRoute(r, k, out, bull);
          if (min > k) {
            expect(route, `${out}/${bull} ${r} in ${k}`).toBeNull();
            continue;
          }
          expect(route, `${out}/${bull} ${r} in ${k}`).not.toBeNull();
          const darts = route as Dart[];
          expect(darts.length).toBe(min);
          expect(darts.reduce((s, d) => s + dartValue(d, bull), 0)).toBe(r);
          expect(isFinisher(darts[darts.length - 1], out, bull)).toBe(true);
          const sim = simulateVisit(r, true, darts, rules);
          expect(sim.checkout).toBe(true);
        }
      }
    }
  });
});

describe('darts in an 01 visit', () => {
  it('applies bust rules for each out mode', () => {
    expect(applyDart(40, true, 'S20', steel).remaining).toBe(20);
    expect(simulateVisit(40, true, ['S20', 'S20'], steel).bust).toBe(true);
    expect(applyDart(2, true, 'S1', steel).bust).toBe(true);
    expect(applyDart(32, true, 'T20', steel).bust).toBe(true);
    expect(applyDart(1, true, 'S1', soft).checkout).toBe(true);
    const master = { inMode: 'open', outMode: 'master', bull: 'separate' } as const;
    expect(applyDart(3, true, 'T1', master).checkout).toBe(true);
    expect(applyDart(3, true, 'S3', master).bust).toBe(true);
  });

  it('scores the bull by bull mode', () => {
    expect(applyDart(50, true, 'S25', { ...steel, bull: 'fat' }).checkout).toBe(true);
    expect(applyDart(50, true, 'S25', steel).remaining).toBe(25);
    expect(applyDart(50, true, 'D25', steel).checkout).toBe(true);
  });

  it('only starts scoring after the in-dart under double-in', () => {
    const din = { inMode: 'double', outMode: 'double', bull: 'separate' } as const;
    const a = applyDart(501, false, 'T20', din);
    expect(a.scored).toBe(0);
    expect(a.isIn).toBe(false);
    const b = applyDart(501, false, 'D20', din);
    expect(b.scored).toBe(40);
    expect(b.isIn).toBe(true);
    expect(simulateVisit(501, false, ['S20', 'D20', 'T20'], din).points).toBe(100);
  });

  it('counts darts thrown at a finish', () => {
    expect(simulateVisit(40, true, ['M', 'S10', 'D15'], steel)).toMatchObject({ checkout: true, used: 3, atFinish: 3 });
    expect(simulateVisit(60, true, ['S20', 'D20'], steel)).toMatchObject({ checkout: true, atFinish: 1 });
  });
});

describe('keypad visit totals', () => {
  it('rejects impossible totals', () => {
    expect(analyzeVisitTotal(501, true, 179, steel).ok).toBe(false);
    expect(analyzeVisitTotal(501, true, 181, steel).ok).toBe(false);
  });

  it('scores a normal visit without questions', () => {
    expect(analyzeVisitTotal(501, true, 180, steel)).toEqual({
      ok: true,
      outcome: 'score',
      total: 180,
      options: [{ used: 3, atFinish: [0] }],
    });
  });

  it('works out darts at a finish when it can', () => {
    const zero = analyzeVisitTotal(40, true, 0, steel);
    expect(zero).toMatchObject({ outcome: 'score', options: [{ used: 3, atFinish: [3] }] });
    const twenty = analyzeVisitTotal(40, true, 20, steel);
    expect(twenty).toMatchObject({ outcome: 'score', options: [{ used: 3, atFinish: [1, 2, 3] }] });
  });

  it('offers darts used and darts at a finish for a checkout', () => {
    const co = analyzeVisitTotal(40, true, 40, steel);
    expect(co).toMatchObject({
      outcome: 'checkout',
      options: [
        { used: 1, atFinish: [1] },
        { used: 2, atFinish: [2] },
        { used: 3, atFinish: [2, 3] },
      ],
    });
  });

  it('turns impossible finishes and overshoots into busts', () => {
    expect(analyzeVisitTotal(159, true, 159, steel)).toMatchObject({ outcome: 'bust' });
    expect(analyzeVisitTotal(169, true, 169, steel).ok).toBe(false);
    expect(analyzeVisitTotal(50, true, 49, steel)).toMatchObject({ outcome: 'bust' });
    expect(analyzeVisitTotal(32, true, 40, steel)).toMatchObject({ outcome: 'bust' });
    expect(analyzeVisitTotal(40, true, 0, steel, true)).toMatchObject({
      outcome: 'bust',
      options: [{ used: 3, atFinish: [1, 2, 3] }],
    });
  });

  it('accepts soft-tip finishes', () => {
    const co = analyzeVisitTotal(50, true, 50, soft);
    expect(co).toMatchObject({ outcome: 'checkout' });
    if (co.ok) expect(co.options[0].used).toBe(1);
  });
});
