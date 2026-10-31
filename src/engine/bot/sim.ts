import { cricketApply, cricketInit, cricketSeatStats } from '../cricket';
import type { Rng } from '../rng';
import { summarizeX01 } from '../stats';
import type { CricketConfig, X01Config } from '../types';
import { x01Apply, x01Init, x01Rules } from '../x01';
import { botDart01, botDartCricket } from './strategy';

const NO_PUNISH = { on: false, bust: false, missedCheckout: false, lowScoreBelow: null, surprisePct: 0 };

export function x01SimConfig(preset: 'soft' | 'steel'): X01Config {
  return {
    kind: 'x01',
    preset,
    start: 501,
    inMode: 'open',
    outMode: preset === 'soft' ? 'open' : 'double',
    bull: preset === 'soft' ? 'fat' : 'separate',
    roundLimit: null,
    legsToWin: 1,
    setsToWin: null,
    entry: 'darts',
    punish: NO_PUNISH,
    timedMinutes: null,
  };
}

/** One solo 501 leg played by a bot through the real game engine. */
export function simulateBotLeg(preset: 'soft' | 'steel', sigma: number, rng: Rng) {
  const c = x01SimConfig(preset);
  const s = x01Init(c, 1);
  const rules = x01Rules(c);
  let i = 0;
  while (s.phase === 'play' && i < 600) {
    const d = botDart01(s.remaining[0], s.isIn[0], 3 - s.visitDarts.length, rules, sigma, rng);
    x01Apply(s, { ts: i, t: 'dart', d }, i);
    i++;
  }
  const [row] = summarizeX01(s);
  return row.m;
}

export const CRICKET_SIM: CricketConfig = { kind: 'cricket', preset: 'soft', variant: 'standard', roundLimit: null, legsToWin: 1 };

/** A bot-vs-bot standard cricket game at the same scatter; returns seat 0's stats. */
export function simulateBotCricket(sigma: number, rng: Rng) {
  const s = cricketInit(CRICKET_SIM, 2);
  let i = 0;
  while (s.phase === 'play' && i < 3000) {
    const d = botDartCricket(s, s.current, sigma, rng);
    cricketApply(s, { ts: i, t: 'dart', d }, i);
    i++;
  }
  return cricketSeatStats(s, 0);
}
