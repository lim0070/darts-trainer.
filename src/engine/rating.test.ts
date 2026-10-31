import { describe, expect, it } from 'vitest';
import { bandMid, estimateRating, flightOf, level01, levelCricket, rollingValue } from './rating';

describe('rating estimate', () => {
  it('maps band edges like the public table', () => {
    expect(Math.floor(level01(39.99))).toBe(1);
    expect(level01(40)).toBe(2);
    expect(Math.floor(level01(101.99))).toBe(13);
    expect(level01(102)).toBe(14);
    expect(level01(130)).toBe(18);
    expect(level01(200)).toBe(18);
    expect(level01(72.5)).toBeCloseTo(8.5);
    expect(Math.floor(levelCricket(1.29))).toBe(1);
    expect(levelCricket(4.75)).toBe(18);
  });

  it('groups levels into flights', () => {
    expect([1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 18].map(flightOf)).toEqual([
      'C',
      'C',
      'CC',
      'CC',
      'B',
      'B',
      'BB',
      'BB',
      'A',
      'A',
      'AA',
      'AA',
      'SA',
      'SA',
    ]);
  });

  it('weights recent games more', () => {
    const v = rollingValue([
      { value: 40, ts: 1 },
      { value: 80, ts: 2 },
    ]);
    expect(v).toBeCloseTo((40 * 1 + 80 * 2) / 3);
  });

  it('combines 01 and cricket and flags provisional ratings', () => {
    const r = estimateRating([{ value: 72.5, ts: 1 }], [{ value: 2.6, ts: 1 }]);
    expect(r.overall).toBeCloseTo((8.5 + 8.5) / 2);
    expect(r.flight).toBe('BB');
    expect(r.provisional).toBe(true);
    expect(bandMid(8, [0, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 102, 109, 116, 123, 130])).toBe(72.5);
  });
});
