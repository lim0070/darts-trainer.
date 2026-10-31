import { reduce } from '../engine/reduce';
import { statRows } from './repo';
import {
  db,
  type GameLogRow,
  type GameRow,
  type PlanRow,
  type PlanRunRow,
  type PlayerRow,
  type PunishLogRow,
  type PunishPoolRow,
  type SettingRow,
} from './schema';

export interface Backup {
  app: 'oche';
  version: 1;
  exportedAt: number;
  tables: {
    players: PlayerRow[];
    games: GameRow[];
    gameLogs: GameLogRow[];
    punishPool: PunishPoolRow[];
    punishLog: PunishLogRow[];
    plans: PlanRow[];
    planRuns: PlanRunRow[];
    settings: SettingRow[];
  };
}

/** Everything except derived stats, which are rebuilt on import. */
export async function exportBackup(): Promise<Backup> {
  return {
    app: 'oche',
    version: 1,
    exportedAt: Date.now(),
    tables: {
      players: await db.players.toArray(),
      games: await db.games.toArray(),
      gameLogs: await db.gameLogs.toArray(),
      punishPool: await db.punishPool.toArray(),
      punishLog: await db.punishLog.toArray(),
      plans: await db.plans.toArray(),
      planRuns: await db.planRuns.toArray(),
      settings: await db.settings.toArray(),
    },
  };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a backup: it isn't valid JSON.");
  }
  const b = data as Partial<Backup>;
  if (b?.app !== 'oche' || b.version !== 1 || !b.tables) throw new Error("This file isn't an Oche backup.");
  return b as Backup;
}

/** Rebuild the per-game stats from the stored events of every finished game. */
export async function rebuildStats(): Promise<number> {
  const games = await db.games.where('status').equals('finished').toArray();
  let n = 0;
  await db.transaction('rw', db.playerStats, db.gameLogs, async () => {
    await db.playerStats.clear();
    for (const g of games) {
      const log = await db.gameLogs.get(g.id);
      if (!log) continue;
      const state = reduce(g.config, g.seats.length, log.events);
      await db.playerStats.bulkPut(statRows(g, state, g.finishedAt ?? g.updatedAt));
      n++;
    }
  });
  return n;
}

/** Merge a backup into this device (same ids are overwritten), then rebuild stats. */
export async function importBackup(b: Backup): Promise<{ games: number }> {
  const t = b.tables;
  await db.transaction(
    'rw',
    [db.players, db.games, db.gameLogs, db.punishPool, db.punishLog, db.plans, db.planRuns, db.settings],
    async () => {
      await db.players.bulkPut(t.players ?? []);
      await db.games.bulkPut(t.games ?? []);
      await db.gameLogs.bulkPut(t.gameLogs ?? []);
      await db.punishPool.bulkPut(t.punishPool ?? []);
      await db.punishLog.bulkPut(t.punishLog ?? []);
      await db.plans.bulkPut(t.plans ?? []);
      await db.planRuns.bulkPut(t.planRuns ?? []);
      const prefs = (t.settings ?? []).find((s) => s.key === 'prefs');
      if (prefs && !(await db.settings.get('prefs'))) await db.settings.put(prefs);
    },
  );
  await rebuildStats();
  return { games: t.games?.length ?? 0 };
}
