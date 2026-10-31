import Dexie, { type Table } from 'dexie';
import type { PunishCard } from '../engine/punish/builtins';
import type { RulesPreset } from '../engine/rules';
import type { DrawnCard, Entry, GameConfig, GameEvent, GameKind, PunishRules, Seat, Trigger } from '../engine/types';

export interface PlayerRow {
  id: string;
  name: string;
  kind: 'human' | 'bot';
  /** Bot rating level 1–18; absent for "match me" bots and humans. */
  level?: number;
  match?: 0 | 1;
  color: string;
  archived: 0 | 1;
  createdAt: number;
}

export type GameStatus = 'active' | 'finished' | 'abandoned';

export interface GameRow {
  id: string;
  kind: GameKind;
  /** Catalogue entry the game was started from (e.g. 't20' for a scoring drill). */
  entry: string;
  config: GameConfig;
  seats: Seat[];
  playerIds: string[];
  status: GameStatus;
  seed: number;
  v: number;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  winnerSeat?: number | null;
  resultLine?: string;
  planRunId?: string;
  planStep?: number;
}

export interface GameLogRow {
  gameId: string;
  events: GameEvent[];
}

export interface PlayerStatsRow {
  id: string;
  gameId: string;
  playerId: string;
  kind: GameKind;
  entry: string;
  /** Groups comparable games, e.g. "501-soft" or "atc-double". */
  variant: string;
  finishedAt: number;
  solo: 0 | 1;
  won: 0 | 1;
  complete: 0 | 1;
  m: Record<string, number>;
  co?: number[];
}

export type PunishPoolRow = PunishCard;

export interface PunishLogRow {
  id: string;
  gameId: string;
  playerId: string;
  eventIdx: number;
  trigger: Trigger;
  card: DrawnCard;
  outcome: 'done' | 'skipped';
  tallyKey?: string;
  reps?: number;
  unit?: 'reps' | 'seconds';
  ts: number;
}

export type PlanLimit = { minutes: number } | { count: number } | { once: true };

export interface PlanStep {
  entry: string;
  config: GameConfig;
  limit: PlanLimit;
  /** Optional opponent for 01/Cricket steps: a bot level or "match". */
  bot?: number | 'match';
}

export interface PlanRow {
  id: string;
  name: string;
  preset: 0 | 1;
  steps: PlanStep[];
  createdAt: number;
}

export interface PlanRunRow {
  id: string;
  planId: string;
  plan: PlanRow;
  status: 'active' | 'finished' | 'abandoned';
  stepIdx: number;
  stepStartedAt: number | null;
  startedAt: number;
  finishedAt?: number;
  results: { gameIds: string[] }[];
}

export interface Prefs {
  preset: RulesPreset;
  entry: Entry;
  punish: PunishRules;
  meId: string | null;
  lastBackupAt: number | null;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export class OcheDB extends Dexie {
  players!: Table<PlayerRow, string>;
  games!: Table<GameRow, string>;
  gameLogs!: Table<GameLogRow, string>;
  playerStats!: Table<PlayerStatsRow, string>;
  punishPool!: Table<PunishPoolRow, string>;
  punishLog!: Table<PunishLogRow, string>;
  plans!: Table<PlanRow, string>;
  planRuns!: Table<PlanRunRow, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = 'oche') {
    super(name);
    this.version(1).stores({
      players: 'id, kind',
      games: 'id, status, createdAt, kind, *playerIds, planRunId',
      gameLogs: 'gameId',
      playerStats: 'id, gameId, playerId, [playerId+kind], finishedAt',
      punishPool: 'id',
      punishLog: 'id, gameId, playerId, tallyKey, ts',
      plans: 'id',
      planRuns: 'id, planId, status, startedAt',
      settings: 'key',
    });
  }
}

export let db = new OcheDB();

/** Tests swap in a fresh database. */
export function useDatabase(next: OcheDB) {
  db = next;
}
