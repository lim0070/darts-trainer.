import type { Rng } from '../rng';
import type { DrawnCard } from '../types';
import type { PunishCard } from './builtins';

/** Weighted random card, never the same one twice in a row (when there is a choice). */
export function drawCard(pool: readonly PunishCard[], lastCardId: string | null, rng: Rng): DrawnCard | null {
  let choices = pool.filter((c) => c.enabled && c.weight > 0);
  if (choices.length > 1 && lastCardId) choices = choices.filter((c) => c.id !== lastCardId);
  if (choices.length === 0) return null;
  const total = choices.reduce((s, c) => s + c.weight, 0);
  let x = rng() * total;
  let chosen = choices[choices.length - 1];
  for (const c of choices) {
    x -= c.weight;
    if (x < 0) {
      chosen = c;
      break;
    }
  }
  const steps = Math.max(0, Math.floor((chosen.max - chosen.min) / Math.max(1, chosen.step)));
  const reps = chosen.min + Math.max(1, chosen.step) * Math.floor(rng() * (steps + 1));
  const hasNumber = chosen.text.includes('{n}');
  return {
    cardId: chosen.id,
    text: hasNumber ? chosen.text.replace('{n}', String(reps)) : chosen.text,
    reps: hasNumber ? reps : undefined,
    unit: hasNumber && chosen.unit ? chosen.unit : undefined,
    tallyKey: hasNumber && chosen.tallyKey ? chosen.tallyKey : undefined,
  };
}
