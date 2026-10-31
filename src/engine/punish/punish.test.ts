import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import type { DrawnCard, VisitRecord } from '../types';
import { BUILTIN_CARDS } from './builtins';
import { drawCard } from './draw';
import { detectTrigger } from './triggers';

const rules = { on: true, bust: true, missedCheckout: true, lowScoreBelow: 26, surprisePct: 0 };
const soft = { inMode: 'open', outMode: 'open', bull: 'fat' } as const;
const steel = { inMode: 'open', outMode: 'double', bull: 'separate' } as const;
const v = (o: Partial<VisitRecord>): VisitRecord => ({
  seat: 0,
  leg: 0,
  round: 1,
  start: 301,
  total: 60,
  used: 3,
  atF: 0,
  bust: false,
  checkout: false,
  ts: 0,
  ...o,
});

describe('punishment triggers', () => {
  it('checks bust, missed finish, low score, then surprise', () => {
    expect(detectTrigger(v({ bust: true, atF: 2, total: 0, start: 40 }), rules, steel, 0.5)).toBe('bust');
    expect(detectTrigger(v({ atF: 3, total: 0, start: 40 }), rules, steel, 0.5)).toBe('missedCheckout');
    expect(detectTrigger(v({ total: 22 }), rules, soft, 0.5)).toBe('lowScore');
    expect(detectTrigger(v({ total: 26 }), rules, soft, 0.5)).toBeNull();
    expect(detectTrigger(v({ total: 60 }), { ...rules, surprisePct: 5 }, soft, 0.01)).toBe('surprise');
    expect(detectTrigger(v({ total: 60 }), { ...rules, surprisePct: 5 }, soft, 0.2)).toBeNull();
  });

  it('never punishes a checkout, and skips low scores inside finishing range', () => {
    expect(detectTrigger(v({ checkout: true, atF: 2, start: 40, total: 40 }), rules, steel, 0)).toBeNull();
    expect(detectTrigger(v({ start: 150, total: 10 }), rules, soft, 0.5)).toBeNull();
    expect(detectTrigger(v({ bust: true }), { ...rules, on: false }, soft, 0)).toBeNull();
  });
});

describe('drawing cards', () => {
  it('respects weights, ranges and steps, and avoids repeats', () => {
    const rng = mulberry32(42);
    const pool = BUILTIN_CARDS.map((c) => ({ ...c, weight: c.id === 'pushups' ? 3 : 1 }));
    const counts = new Map<string, number>();
    let last: string | null = null;
    for (let i = 0; i < 10000; i++) {
      const card: DrawnCard = drawCard(pool, last, rng)!;
      expect(card.cardId).not.toBe(last);
      counts.set(card.cardId, (counts.get(card.cardId) ?? 0) + 1);
      const def = pool.find((c) => c.id === card.cardId)!;
      if (card.reps !== undefined) {
        expect(card.reps).toBeGreaterThanOrEqual(def.min);
        expect(card.reps).toBeLessThanOrEqual(def.max);
        expect((card.reps - def.min) % def.step).toBe(0);
        expect(card.text).toContain(String(card.reps));
      }
      last = card.cardId;
    }
    expect(counts.get('pushups')!).toBeGreaterThan(counts.get('squats')! * 2);
  });

  it('returns null when every card is off', () => {
    expect(
      drawCard(
        BUILTIN_CARDS.map((c) => ({ ...c, enabled: false })),
        null,
        mulberry32(1),
      ),
    ).toBeNull();
  });
});
