import type { ThrowRules } from '../rules';
import { canFinish } from '../tables';
import type { PunishRules, Trigger, VisitRecord } from '../types';

/**
 * Which punishment (if any) a finished visit earns. The first match wins,
 * so a visit never gets more than one card. `roll` is a 0–1 random number.
 */
export function detectTrigger(v: VisitRecord, rules: PunishRules, throwRules: ThrowRules, roll: number): Trigger | null {
  if (!rules.on || v.checkout) return null;
  if (rules.bust && v.bust) return 'bust';
  if (rules.missedCheckout && v.atF > 0) return 'missedCheckout';
  if (
    rules.lowScoreBelow !== null &&
    !v.bust &&
    !canFinish(v.start, 3, throwRules.outMode, throwRules.bull) &&
    v.total < rules.lowScoreBelow
  ) {
    return 'lowScore';
  }
  if (rules.surprisePct > 0 && roll < rules.surprisePct / 100) return 'surprise';
  return null;
}

export function triggerReason(t: Trigger, v: VisitRecord): string {
  switch (t) {
    case 'bust':
      return `Bust from ${v.start}`;
    case 'missedCheckout':
      return v.atF === 1 ? `Missed a finish on ${v.start}` : `Missed ${v.atF} darts at a finish`;
    case 'lowScore':
      return `Only ${v.total} scored`;
    case 'surprise':
      return 'Surprise card';
  }
}
