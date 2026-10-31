import { MPR_FROM, PPR_FROM, bandMid } from '../rating';
import type { RulesPreset } from '../rules';
import { SIGMA_01_SOFT, SIGMA_01_STEEL, SIGMA_CRICKET } from './calibration';

export const BOT_LEVELS = Array.from({ length: 18 }, (_, i) => i + 1);

/** Scatter for a (possibly fractional) level, interpolated on a log scale. */
export function sigmaFromTable(level: number, table: readonly number[]): number {
  const l = Math.min(18, Math.max(1, level));
  const i = Math.floor(l) - 1;
  if (i >= table.length - 1) return table[table.length - 1];
  const f = l - (i + 1);
  return Math.exp(Math.log(table[i]) * (1 - f) + Math.log(table[i + 1]) * f);
}

export function sigma01(level: number, preset: RulesPreset): number {
  return sigmaFromTable(level, preset === 'soft' ? SIGMA_01_SOFT : SIGMA_01_STEEL);
}

export function sigmaCricket(level: number): number {
  return sigmaFromTable(level, SIGMA_CRICKET);
}

/** What a bot of this level aims to average (80% stats). */
export const targetPpr = (level: number) => bandMid(level, PPR_FROM);
export const targetMpr = (level: number) => bandMid(level, MPR_FROM);
