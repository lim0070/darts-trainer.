import { type Dart, dartMult, dartNum } from './darts';

export type BullMode = 'fat' | 'separate';
export type InMode = 'open' | 'double' | 'master';
export type OutMode = 'open' | 'double' | 'master';
export type RulesPreset = 'soft' | 'steel';

export interface ThrowRules {
  inMode: InMode;
  outMode: OutMode;
  bull: BullMode;
}

/** Soft-tip (DARTSLIVE-style) vs steel-tip defaults for 01 games. */
export function presetRules(preset: RulesPreset): ThrowRules {
  return preset === 'soft' ? { inMode: 'open', outMode: 'open', bull: 'fat' } : { inMode: 'open', outMode: 'double', bull: 'separate' };
}

/** DARTSLIVE rulebook: 15 rounds for 301–701, 20 rounds for 901–1501. Steel has no limit. */
export function defaultRoundLimit(preset: RulesPreset, start: number): number | null {
  if (preset === 'steel') return null;
  return start <= 701 ? 15 : 20;
}

export function dartValue(d: Dart, bull: BullMode): number {
  if (d === 'M') return 0;
  if (d === 'S25') return bull === 'fat' ? 50 : 25;
  if (d === 'D25') return 50;
  return dartMult(d) * dartNum(d);
}

/** Counts as a double for double-in/out. With fat bull the whole bull counts. */
export function isDoubleLike(d: Dart, bull: BullMode): boolean {
  if (d === 'D25') return true;
  if (d === 'S25') return bull === 'fat';
  return d[0] === 'D';
}

export const isTreble = (d: Dart): boolean => d[0] === 'T';

export function isFinisher(d: Dart, out: OutMode, bull: BullMode): boolean {
  if (d === 'M') return false;
  if (out === 'open') return true;
  if (out === 'double') return isDoubleLike(d, bull);
  return isDoubleLike(d, bull) || isTreble(d);
}

export function isInDart(d: Dart, inMode: InMode, bull: BullMode): boolean {
  if (d === 'M') return false;
  if (inMode === 'open') return true;
  if (inMode === 'double') return isDoubleLike(d, bull);
  return isDoubleLike(d, bull) || isTreble(d);
}

export function dartLabel(d: Dart, bull: BullMode): string {
  if (d === 'M') return 'Miss';
  if (d === 'D25') return bull === 'fat' ? 'Bull' : 'Bull 50';
  if (d === 'S25') return bull === 'fat' ? 'Bull' : 'Bull 25';
  return d;
}
