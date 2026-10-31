import { catalogEntry, cricketDefaults, type DefaultsCtx, x01Defaults } from '../drills/catalogue';
import type { GameConfig } from '../types';

export type PresetLimit = { minutes: number } | { count: number } | { once: true };

export interface PresetStep {
  entry: string;
  config: GameConfig;
  limit: PresetLimit;
  bot?: number | 'match';
}

export interface PresetPlan {
  id: string;
  name: string;
  steps: PresetStep[];
}

function drill(id: string, ctx: DefaultsCtx, limit: PresetLimit, patch: Partial<GameConfig> = {}): PresetStep {
  const entry = catalogEntry(id);
  if (!entry) throw new Error(`Unknown drill ${id}`);
  return { entry: id, config: { ...entry.defaults(ctx), ...patch } as GameConfig, limit };
}

export function presetPlans(ctx: DefaultsCtx): PresetPlan[] {
  return [
    {
      id: 'preset-soft-daily',
      name: 'Soft-tip daily',
      steps: [
        drill('countup', ctx, { count: 3 }),
        drill('cricketcountup', ctx, { count: 2 }),
        drill('eagleseye', ctx, { count: 1 }),
        { entry: 'x01', config: x01Defaults(ctx, 501), limit: { once: true }, bot: 'match' },
      ],
    },
    {
      id: 'preset-finishing',
      name: 'Finishing school',
      steps: [
        drill('finish', ctx, { minutes: 10 }, { attempts: null } as Partial<GameConfig>),
        drill('ladder121', ctx, { minutes: 10 }, { rounds: null } as Partial<GameConfig>),
        drill('bobs27', ctx, { once: true }),
      ],
    },
    {
      id: 'preset-doubles',
      name: 'Doubles day',
      steps: [
        drill('atc', ctx, { once: true }, { ring: 'double' } as Partial<GameConfig>),
        drill('frustration', ctx, { once: true }),
        drill('catch40', ctx, { once: true }),
      ],
    },
  ];
}

export { cricketDefaults };
