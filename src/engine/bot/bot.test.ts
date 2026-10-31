import { describe, expect, it } from 'vitest';
import { SEGMENT_ORDER } from '../darts';
import { MPR_FROM, PPR_FROM } from '../rating';
import { mulberry32 } from '../rng';
import { aimPoint, segmentAt } from './board';
import { sigma01, sigmaCricket } from './level';
import { simulateBotCricket, simulateBotLeg } from './sim';
import { aim01 } from './strategy';

describe('board geometry', () => {
  it('maps the centre of every bed back to itself', () => {
    for (const n of SEGMENT_ORDER) {
      for (const d of [`S${n}`, `D${n}`, `T${n}`] as const) {
        const p = aimPoint(d);
        expect(segmentAt(p.x, p.y)).toBe(d);
      }
    }
    expect(segmentAt(0, 0)).toBe('D25');
    expect(segmentAt(10, 0)).toBe('S25');
    expect(segmentAt(0, 171)).toBe('M');
  });

  it('puts 20 at the top, 6 on the right, 3 at the bottom and 11 on the left', () => {
    expect(segmentAt(0, 120)).toBe('S20');
    expect(segmentAt(120, 0)).toBe('S6');
    expect(segmentAt(0, -120)).toBe('S3');
    expect(segmentAt(-120, 0)).toBe('S11');
    // Segment boundary: 9° either side of the top belongs to 20, just past it to 1.
    const a = (8.9 * Math.PI) / 180;
    expect(segmentAt(120 * Math.sin(a), 120 * Math.cos(a))).toBe('S20');
    const b = (9.1 * Math.PI) / 180;
    expect(segmentAt(120 * Math.sin(b), 120 * Math.cos(b))).toBe('S1');
  });
});

describe('bot aiming', () => {
  const steel = { inMode: 'open', outMode: 'double', bull: 'separate' } as const;
  it('follows checkout routes and avoids busting setups', () => {
    expect(aim01(100, true, 3, steel, 10)).toBe('T20');
    expect(aim01(40, true, 1, steel, 10)).toBe('D20');
    // 59 with one dart left can't be finished: set up a double without leaving 1.
    const setup = aim01(59, true, 1, steel, 10);
    expect(setup[0]).toBe('S');
  });
});

describe('bot calibration', () => {
  const band = (from: number[], level: number) => [from[level - 1], from[level] ?? Infinity];

  it.each([4, 8, 12, 16])('soft 01 level %i averages inside its band', (level) => {
    const rng = mulberry32(99 + level);
    let pts = 0;
    let rounds = 0;
    for (let i = 0; i < 400; i++) {
      const m = simulateBotLeg('soft', sigma01(level, 'soft'), rng);
      pts += m.p80pts;
      rounds += m.p80rounds;
    }
    const [lo, hi] = band(PPR_FROM, level);
    expect(pts / rounds).toBeGreaterThanOrEqual(lo);
    expect(pts / rounds).toBeLessThan(hi);
  });

  it.each([5, 10, 15])('cricket level %i averages inside its MPR band', (level) => {
    const rng = mulberry32(7 + level);
    let marks = 0;
    let rounds = 0;
    for (let i = 0; i < 200; i++) {
      const st = simulateBotCricket(sigmaCricket(level), rng);
      marks += st.p80marks;
      rounds += st.p80rounds;
    }
    const [lo, hi] = band(MPR_FROM, level);
    expect(marks / rounds).toBeGreaterThanOrEqual(lo);
    expect(marks / rounds).toBeLessThan(hi);
  });
});
