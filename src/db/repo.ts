import { BUILTIN_CARDS } from '../engine/punish/builtins';
import { variantOf } from '../engine/drills/catalogue';
import { presetPlans } from '../engine/plans/presets';
import { type AnyState, summarize } from '../engine/reduce';
import { newSeed } from '../engine/rng';
import type { GameConfig, GameEvent, PunishRules, Seat } from '../engine/types';
import { db, type GameRow, type PlayerRow, type PlayerStatsRow, type Prefs, type PunishLogRow } from './schema';

export const uid = () => crypto.randomUUID();

export const DEFAULT_PUNISH: PunishRules = {
  on: true,
  bust: true,
  missedCheckout: true,
  lowScoreBelow: 26,
  surprisePct: 0,
};

export const DEFAULT_PREFS: Prefs = {
  preset: 'soft',
  entry: 'total',
  punish: DEFAULT_PUNISH,
  meId: null,
  lastBackupAt: null,
};

export const PLAYER_COLORS = ['#FF4A3D', '#3FA2FF', '#F2C14E', '#7BD389', '#C77DFF', '#F78C6B'];

export async function getPrefs(): Promise<Prefs> {
  const row = await db.settings.get('prefs');
  return { ...DEFAULT_PREFS, ...((row?.value as Partial<Prefs>) ?? {}) };
}

export async function setPrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs()), ...patch };
  await db.settings.put({ key: 'prefs', value: next });
  return next;
}

/** First run: a player for you, the built-in punishment cards and the preset plans. */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', [db.players, db.punishPool, db.plans, db.settings], async () => {
    const prefs = await getPrefs();
    if (!prefs.meId || !(await db.players.get(prefs.meId))) {
      const humans = await db.players.where('kind').equals('human').toArray();
      const me =
        humans[0] ??
        ({ id: uid(), name: 'You', kind: 'human', color: PLAYER_COLORS[0], archived: 0, createdAt: Date.now() } satisfies PlayerRow);
      if (!humans[0]) await db.players.add(me);
      await db.settings.put({ key: 'prefs', value: { ...prefs, meId: me.id } });
    }
    if ((await db.punishPool.count()) === 0) await db.punishPool.bulkAdd(BUILTIN_CARDS);
    if ((await db.plans.count()) === 0) {
      const ctx = { preset: prefs.preset, entry: prefs.entry, punish: prefs.punish };
      await db.plans.bulkAdd(
        presetPlans(ctx).map((p) => ({ id: p.id, name: p.name, preset: 1 as const, steps: p.steps, createdAt: Date.now() })),
      );
    }
  });
}

export async function addPlayer(name: string): Promise<PlayerRow> {
  const count = await db.players.where('kind').equals('human').count();
  const row: PlayerRow = {
    id: uid(),
    name: name.trim() || `Player ${count + 1}`,
    kind: 'human',
    color: PLAYER_COLORS[count % PLAYER_COLORS.length],
    archived: 0,
    createdAt: Date.now(),
  };
  await db.players.add(row);
  return row;
}

/** Bot opponents are stored as players so head-to-head results build up. */
export async function botPlayer(level: number | 'match'): Promise<PlayerRow> {
  const id = level === 'match' ? 'bot-match' : `bot-${level}`;
  const existing = await db.players.get(id);
  if (existing) return existing;
  const row: PlayerRow = {
    id,
    name: level === 'match' ? 'Bot (your level)' : `Bot Rt ${level}`,
    kind: 'bot',
    level: level === 'match' ? undefined : level,
    match: level === 'match' ? 1 : 0,
    color: '#8FA6BF',
    archived: 0,
    createdAt: Date.now(),
  };
  await db.players.put(row);
  return row;
}

export async function createGame(
  entry: string,
  config: GameConfig,
  seats: Seat[],
  opts: { planRunId?: string; planStep?: number } = {},
): Promise<string> {
  const id = uid();
  const now = Date.now();
  const game: GameRow = {
    id,
    kind: config.kind,
    entry,
    config,
    seats,
    playerIds: seats.map((s) => s.playerId),
    status: 'active',
    seed: newSeed(),
    v: 1,
    createdAt: now,
    updatedAt: now,
    ...opts,
  };
  await db.transaction('rw', db.games, db.gameLogs, async () => {
    await db.games.add(game);
    await db.gameLogs.add({ gameId: id, events: [] });
  });
  return id;
}

export async function saveEvents(gameId: string, events: GameEvent[]): Promise<void> {
  await db.transaction('rw', db.games, db.gameLogs, async () => {
    await db.gameLogs.put({ gameId, events });
    await db.games.update(gameId, { updatedAt: Date.now() });
  });
}

export function statRows(game: GameRow, state: AnyState, finishedAt: number): PlayerStatsRow[] {
  const rows = summarize(state);
  const solo = game.seats.length === 1 ? 1 : 0;
  return rows.map((r) => ({
    id: `${game.id}:${r.seat}`,
    gameId: game.id,
    playerId: game.seats[r.seat].playerId,
    kind: game.kind,
    entry: game.entry,
    variant: variantOf(game.config),
    finishedAt,
    solo,
    won: r.won ? 1 : 0,
    complete: state.ended === 'stopped' ? 0 : 1,
    m: r.m,
    co: r.co,
  }));
}

export async function finishGame(game: GameRow, state: AnyState, resultLine: string): Promise<void> {
  const finishedAt = Date.now();
  await db.transaction('rw', db.games, db.playerStats, async () => {
    await db.games.update(game.id, {
      status: 'finished',
      finishedAt,
      winnerSeat: state.winner,
      resultLine,
      updatedAt: finishedAt,
    });
    await db.playerStats.where('gameId').equals(game.id).delete();
    await db.playerStats.bulkPut(statRows(game, state, finishedAt));
  });
}

/** Undo after the end: the game is live again and its stats are withdrawn. */
export async function reopenGame(gameId: string): Promise<void> {
  await db.transaction('rw', db.games, db.playerStats, async () => {
    await db.games.update(gameId, { status: 'active', finishedAt: undefined, winnerSeat: undefined, resultLine: undefined });
    await db.playerStats.where('gameId').equals(gameId).delete();
  });
}

export async function abandonGame(gameId: string): Promise<void> {
  await db.games.update(gameId, { status: 'abandoned', updatedAt: Date.now() });
}

export async function deleteGame(gameId: string): Promise<void> {
  await db.transaction('rw', [db.games, db.gameLogs, db.playerStats, db.punishLog], async () => {
    await db.games.delete(gameId);
    await db.gameLogs.delete(gameId);
    await db.playerStats.where('gameId').equals(gameId).delete();
    await db.punishLog.where('gameId').equals(gameId).delete();
  });
}

export async function addPunishLog(row: PunishLogRow): Promise<void> {
  await db.punishLog.put(row);
}

/** Undo removes punishment results logged at or after the cut. */
export async function trimPunishLog(gameId: string, fromEventIdx: number): Promise<void> {
  await db.punishLog
    .where('gameId')
    .equals(gameId)
    .filter((r) => r.eventIdx >= fromEventIdx)
    .delete();
}

export async function activeGame(): Promise<GameRow | undefined> {
  const list = await db.games.where('status').equals('active').toArray();
  return list.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
