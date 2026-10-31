import type { Dart } from './darts';
import type { BullMode, InMode, OutMode, RulesPreset } from './rules';

export type Entry = 'total' | 'darts';

export type DrillKind =
  | 'countup'
  | 'eagleseye'
  | 'cricketcountup'
  | 'halfit'
  | 'shootout'
  | 'shanghai'
  | 'jdc'
  | 'bobs27'
  | 'scoring'
  | 'atc'
  | 'frustration'
  | 'ladder121'
  | 'finish'
  | 'catch40'
  | 'p170'
  | 'checklist';

export type GameKind = 'x01' | 'cricket' | DrillKind;

export interface PunishRules {
  on: boolean;
  bust: boolean;
  missedCheckout: boolean;
  /** Visits under this score (outside finishing range) trigger a card. */
  lowScoreBelow: number | null;
  /** Chance per visit, 0–100. */
  surprisePct: number;
}

export type Trigger = 'bust' | 'missedCheckout' | 'lowScore' | 'surprise';

export interface DrawnCard {
  cardId: string;
  text: string;
  reps?: number;
  unit?: 'reps' | 'seconds';
  tallyKey?: string;
}

export interface BotSeat {
  /** Rating level 1–18 (fractional for "match me"). */
  level: number;
  /** Scatter in mm used for this game. */
  sigma: number;
  match: boolean;
}

export interface Seat {
  playerId: string;
  name: string;
  bot?: BotSeat;
}

export interface X01Config {
  kind: 'x01';
  preset: RulesPreset;
  start: number;
  inMode: InMode;
  outMode: OutMode;
  bull: BullMode;
  roundLimit: number | null;
  /** Legs per set when sets are on, otherwise legs to win. Solo: legs to play. */
  legsToWin: number;
  setsToWin: number | null;
  entry: Entry;
  punish: PunishRules;
  /** Speed 501: play legs until the timer runs out. */
  timedMinutes: number | null;
}

export interface CricketConfig {
  kind: 'cricket';
  preset: RulesPreset;
  variant: 'standard' | 'cutthroat';
  roundLimit: number | null;
  legsToWin: number;
}

export type RoundTarget =
  | { k: 'any' }
  | { k: 'num'; n: number }
  | { k: 'bull' }
  | { k: 'double'; n: number }
  | { k: 'anyDouble' }
  | { k: 'anyTreble' };

export interface CountUpConfig {
  kind: 'countup';
  rounds: number;
  bull: BullMode;
  entry: Entry;
}
export interface EaglesEyeConfig {
  kind: 'eagleseye';
  rounds: number;
}
export interface CricketCountUpConfig {
  kind: 'cricketcountup';
}
export interface HalfItConfig {
  kind: 'halfit';
  start: number;
  targets: RoundTarget[];
  bull: BullMode;
}
export interface ShootOutConfig {
  kind: 'shootout';
  rounds: number;
  bull: BullMode;
}
export interface ShanghaiConfig {
  kind: 'shanghai';
  /** Last number played (7 or 20). */
  to: number;
  bonus: number;
}
export interface JdcConfig {
  kind: 'jdc';
}
export interface Bobs27Config {
  kind: 'bobs27';
  bull: boolean;
  continueBelowZero: boolean;
}
export interface ScoringConfig {
  kind: 'scoring';
  /** 1–20, 25 for the bull, or any target. */
  target: number | 'any';
  darts: number;
  /** For the scoring challenge: count visits at or above this. */
  threshold: number | null;
  bull: BullMode;
  entry: Entry;
}
export interface AtcConfig {
  kind: 'atc';
  ring: 'single' | 'double' | 'treble';
}
export interface FrustrationConfig {
  kind: 'frustration';
}
export type Safehouse = 'start' | 'three' | 'six' | 'row3' | 'row5' | 'each';
export interface Ladder121Config {
  kind: 'ladder121';
  start: number;
  darts: number;
  step: number;
  safehouse: Safehouse;
  rounds: number | null;
  outMode: OutMode;
  bull: BullMode;
  entry: Entry;
}
export interface FinishConfig {
  kind: 'finish';
  min: number;
  max: number;
  darts: number;
  outMode: OutMode;
  bull: BullMode;
  attempts: number | null;
  entry: Entry;
}
export interface Catch40Config {
  kind: 'catch40';
  bull: BullMode;
  entry: Entry;
}
export interface P170Config {
  kind: 'p170';
  attempts: number;
  bull: BullMode;
  entry: Entry;
}
export interface ChecklistConfig {
  kind: 'checklist';
  targets: number[];
  darts: number;
  outMode: OutMode;
  bull: BullMode;
  entry: Entry;
}

export type RoundDrillConfig =
  | CountUpConfig
  | EaglesEyeConfig
  | CricketCountUpConfig
  | HalfItConfig
  | ShootOutConfig
  | ShanghaiConfig
  | JdcConfig
  | Bobs27Config
  | ScoringConfig;
export type SequenceDrillConfig = AtcConfig | FrustrationConfig;
export type CheckoutDrillConfig = Ladder121Config | FinishConfig | Catch40Config | P170Config | ChecklistConfig;
export type DrillConfig = RoundDrillConfig | SequenceDrillConfig | CheckoutDrillConfig;
export type GameConfig = X01Config | CricketConfig | DrillConfig;

export type GameEvent = { ts: number; auto?: true } & (
  | { t: 'dart'; d: Dart }
  | { t: 'visit'; total: number; bust?: true; used?: number; atF?: number }
  /** Quick drill result for a whole visit (Frustration: 0 under 80, 1 missed double, 2 hit). */
  | { t: 'res'; v: number }
  /** Random checkout target chosen by the app. */
  | { t: 'target'; value: number }
  /** Bull-off winner (seat index) after a round limit. */
  | { t: 'cork'; winner: number }
  | { t: 'punish'; seat: number; trigger: Trigger; card: DrawnCard }
  | { t: 'punishDone'; outcome: 'done' | 'skipped' }
  | { t: 'end'; reason: 'timeUp' | 'stopped' }
);

export type GameEventOf<T extends GameEvent['t']> = Extract<GameEvent, { t: T }>;

/** One player's visit (up to three darts). Shared by every game type. */
export interface VisitRecord {
  seat: number;
  /** Leg, attempt or game index depending on the game. */
  leg: number;
  round: number;
  /** Score left (01) or score before the visit (drills). */
  start: number;
  /** Points scored in the visit (0 for a bust). */
  total: number;
  darts?: Dart[];
  used: number;
  atF: number;
  bust: boolean;
  checkout: boolean;
  ts: number;
  /** Cricket: marks that counted. Drills: hits on target. */
  marks?: number;
}

export interface PendingPunish {
  seat: number;
  trigger: Trigger;
  card: DrawnCard;
}

export type Phase = 'play' | 'cork' | 'over';

/** What the game is waiting for next. */
export type Need =
  | { k: 'throw'; seat: number }
  | { k: 'bot'; seat: number }
  | { k: 'punish'; seat: number }
  | { k: 'cork' }
  | { k: 'target' }
  | { k: 'over' };
