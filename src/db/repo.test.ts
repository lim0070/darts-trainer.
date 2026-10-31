import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { reduce } from '../engine/reduce';
import { x01Defaults } from '../engine/drills/catalogue';
import type { GameEvent } from '../engine/types';
import { exportBackup, importBackup, parseBackup } from './backup';
import { addPunishLog, createGame, ensureSeed, finishGame, getPrefs, reopenGame, saveEvents, trimPunishLog } from './repo';
import { OcheDB, db, useDatabase } from './schema';

let n = 0;
beforeEach(async () => {
  useDatabase(new OcheDB(`test-${++n}`));
  await ensureSeed();
});

const ctx = {
  preset: 'soft' as const,
  entry: 'total' as const,
  punish: { on: true, bust: true, missedCheckout: true, lowScoreBelow: 26, surprisePct: 0 },
};

async function playSolo301() {
  const prefs = await getPrefs();
  const config = { ...x01Defaults(ctx, 301) };
  const id = await createGame('x01', config, [{ playerId: prefs.meId!, name: 'You' }]);
  const events: GameEvent[] = [
    { ts: 1, t: 'visit', total: 180 },
    { ts: 2, t: 'visit', total: 81 },
    { ts: 3, t: 'visit', total: 40, used: 1, atF: 1 },
  ];
  await saveEvents(id, events);
  const game = (await db.games.get(id))!;
  await finishGame(game, reduce(config, 1, events), 'PPR 129.0');
  return { id, prefs };
}

describe('repository', () => {
  it('seeds a player, the punishment cards and the preset plans once', async () => {
    await ensureSeed();
    const prefs = await getPrefs();
    expect(prefs.meId).toBeTruthy();
    expect(await db.players.count()).toBe(1);
    expect(await db.punishPool.count()).toBe(10);
    expect(await db.plans.count()).toBe(3);
  });

  it('stores stats when a game finishes and withdraws them on undo', async () => {
    const { id, prefs } = await playSolo301();
    const rows = await db.playerStats.where('playerId').equals(prefs.meId!).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].m).toMatchObject({ pts: 301, darts: 7 });
    await reopenGame(id);
    expect(await db.playerStats.count()).toBe(0);
    expect((await db.games.get(id))!.status).toBe('active');
  });

  it('trims punishment results after an undo point', async () => {
    const { id, prefs } = await playSolo301();
    for (const idx of [2, 5]) {
      await addPunishLog({
        id: `${id}:${idx}`,
        gameId: id,
        playerId: prefs.meId!,
        eventIdx: idx,
        trigger: 'bust',
        card: { cardId: 'pushups', text: '10 push-ups', reps: 10 },
        outcome: 'done',
        tallyKey: 'pushups',
        reps: 10,
        unit: 'reps',
        ts: idx,
      });
    }
    await trimPunishLog(id, 4);
    expect((await db.punishLog.toArray()).map((r) => r.eventIdx)).toEqual([2]);
  });

  it('round-trips a backup into a fresh device and rebuilds stats', async () => {
    await playSolo301();
    const text = JSON.stringify(await exportBackup());
    useDatabase(new OcheDB(`test-${++n}`));
    const res = await importBackup(parseBackup(text));
    expect(res.games).toBe(1);
    expect(await db.playerStats.count()).toBe(1);
    expect(() => parseBackup('{"app":"other"}')).toThrow();
  });
});
