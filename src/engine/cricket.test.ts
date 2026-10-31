import { describe, expect, it } from 'vitest';
import type { Dart } from './darts';
import { cricketApply, cricketInit, cricketSeatStats, type CricketState } from './cricket';
import type { CricketConfig, GameEvent } from './types';

const cfg = (o: Partial<CricketConfig> = {}): CricketConfig => ({
  kind: 'cricket',
  preset: 'soft',
  variant: 'standard',
  roundLimit: 20,
  legsToWin: 1,
  ...o,
});
const dart = (d: Dart): GameEvent => ({ ts: 0, t: 'dart', d });
function play(c: CricketConfig, seats: number, darts: Dart[]): CricketState {
  const s = cricketInit(c, seats);
  darts.forEach((d, i) => cricketApply(s, dart(d), i));
  return s;
}
const ALL_CLOSE: Dart[] = ['T20', 'T19', 'T18', 'T17', 'T16', 'T15', 'D25', 'S25'];

describe('cricket', () => {
  it('closes a number and scores the extra marks while the opponent is open', () => {
    const s = play(cfg(), 2, ['T20', 'T20', 'T20']);
    expect(s.marks[0][0]).toBe(3);
    expect(s.points).toEqual([120, 0]);
    expect(s.visits[0].marks).toBe(9);
    expect(s.current).toBe(1);
  });

  it('gives points to open opponents in cut-throat', () => {
    const s = play(cfg({ variant: 'cutthroat' }), 3, ['T20', 'T20', 'M']);
    expect(s.points).toEqual([0, 60, 60]);
  });

  it('stops scoring on a number everyone has closed', () => {
    const s = play(cfg(), 2, ['T20', 'M', 'M', 'T20', 'M', 'M', 'T20', 'M', 'M']);
    expect(s.points).toEqual([0, 0]);
    expect(s.visits[2].marks).toBe(0);
  });

  it('counts the bull as 1 or 2 marks worth 25 each', () => {
    const s = play(cfg(), 2, ['D25', 'D25', 'M']);
    expect(s.marks[0][6]).toBe(3);
    expect(s.points[0]).toBe(25);
  });

  it('wins when all are closed with at least as many points', () => {
    const s = play(cfg(), 2, ['T20', 'T19', 'T18', 'M', 'M', 'M', 'T17', 'T16', 'T15', 'M', 'M', 'M', 'D25', 'S25']);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(s.visits[s.visits.length - 1]).toMatchObject({ checkout: true, used: 2 });
  });

  it('ends a solo game once everything is closed', () => {
    const s = play(cfg(), 1, ALL_CLOSE);
    expect(s.phase).toBe('over');
    const st = cricketSeatStats(s, 0);
    expect(st.marks).toBe(21);
    expect(st.darts).toBe(8);
    expect(st.p80rounds).toBe(2);
  });

  it('decides on points, then a cork, at the round limit', () => {
    const lead = play(cfg({ roundLimit: 1 }), 2, ['T20', 'S20', 'M', 'M', 'M', 'M']);
    expect(lead.winner).toBe(0);
    const tie = play(cfg({ roundLimit: 1 }), 2, ['M', 'M', 'M', 'M', 'M', 'M']);
    expect(tie.phase).toBe('cork');
    cricketApply(tie, { ts: 0, t: 'cork', winner: 1 }, 6);
    expect(tie.winner).toBe(1);
  });
});
