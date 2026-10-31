import type { RulesPreset } from '../rules';
import { defaultRoundLimit, presetRules } from '../rules';
import type { Entry, GameConfig, PunishRules } from '../types';
import { HALF_IT_DEFAULT } from './roundGame';

export type CatalogGroup = 'scoring' | 'bull' | 'cricket' | 'doubles' | 'finishing' | 'coverage';

export const GROUPS: { id: CatalogGroup; name: string; blurb: string }[] = [
  { id: 'scoring', name: 'Scoring', blurb: 'Big numbers, fast' },
  { id: 'bull', name: 'Bull', blurb: 'Hit the middle' },
  { id: 'cricket', name: 'Cricket', blurb: '20 to 15 and the bull' },
  { id: 'doubles', name: 'Doubles', blurb: 'The outer ring' },
  { id: 'finishing', name: 'Finishing', blurb: 'Close out the leg' },
  { id: 'coverage', name: 'Whole board', blurb: 'Every number counts' },
];

export interface DefaultsCtx {
  preset: RulesPreset;
  entry: Entry;
  punish: PunishRules;
}

export interface MainStat {
  label: string;
  better: 'high' | 'low';
  /** Value from a stats row's counters, or null if the game didn't produce one. */
  value: (m: Record<string, number>) => number | null;
  format: (v: number) => string;
  /** How to roll several games into one number. */
  combine: 'mean' | 'ratio';
}

export interface CatalogEntry {
  id: string;
  name: string;
  group: CatalogGroup;
  blurb: string;
  rules: string;
  multi: boolean;
  origin?: string;
  defaults: (ctx: DefaultsCtx) => GameConfig;
  main: MainStat;
}

const int = (v: number) => String(Math.round(v));
const one = (v: number) => v.toFixed(1);
const pctFmt = (v: number) => `${Math.round(v)}%`;
const ratio = (num: number | undefined, den: number | undefined) => (den ? (100 * (num ?? 0)) / den : null);

const score: MainStat = {
  label: 'Score',
  better: 'high',
  value: (m) => (m.complete ? m.score : null),
  format: int,
  combine: 'mean',
};

const bullFor = (p: RulesPreset) => presetRules(p).bull;

export const CATALOGUE: CatalogEntry[] = [
  {
    id: 'countup',
    name: 'Count-Up',
    group: 'scoring',
    origin: 'DARTSLIVE',
    blurb: 'Eight rounds, highest total wins',
    rules:
      'Throw 3 darts a round for 8 rounds and add up everything you hit. Fat bull scores 50. 400 is a solid start, 600 is intermediate, 800 advanced, 1000+ master.',
    multi: true,
    defaults: (c) => ({ kind: 'countup', rounds: 8, bull: bullFor(c.preset), entry: c.entry }),
    main: score,
  },
  {
    id: 't20',
    name: 'T20 drill',
    group: 'scoring',
    blurb: 'Darts at treble 20, count the hits',
    rules: 'Throw every dart at treble 20. Hits on any 20 count, trebles are tracked separately.',
    multi: true,
    defaults: (c) => ({ kind: 'scoring', target: 20, darts: 60, threshold: null, bull: bullFor(c.preset), entry: 'darts' }),
    main: { label: 'Treble %', better: 'high', value: (m) => ratio(m.trebles, m.darts), format: pctFmt, combine: 'ratio' },
  },
  {
    id: 'hundred',
    name: '100 darts',
    group: 'scoring',
    blurb: '100 darts at one target',
    rules: 'Pick a target and throw 100 darts at it. Repeat weekly to chart your accuracy.',
    multi: true,
    defaults: (c) => ({ kind: 'scoring', target: 20, darts: 100, threshold: null, bull: bullFor(c.preset), entry: 'darts' }),
    main: { label: 'Hit %', better: 'high', value: (m) => ratio(m.hits, m.darts), format: pctFmt, combine: 'ratio' },
  },
  {
    id: 'challenge',
    name: 'Scoring challenge',
    group: 'scoring',
    blurb: 'How often you clear 60 a visit',
    rules: 'Score as much as you can each visit. The stat is the share of visits at or above your target score.',
    multi: true,
    defaults: (c) => ({ kind: 'scoring', target: 'any', darts: 60, threshold: 60, bull: bullFor(c.preset), entry: c.entry }),
    main: { label: 'Visits over target', better: 'high', value: (m) => ratio(m.over, m.rounds), format: pctFmt, combine: 'ratio' },
  },
  {
    id: 'speed501',
    name: 'Speed 501',
    group: 'scoring',
    blurb: '501 legs against the clock',
    rules: 'Play 501 legs until the timer runs out. Only finished legs count. Benchmarks: 24 darts is good, 16 is advanced.',
    multi: false,
    defaults: (c) => ({
      kind: 'x01',
      preset: c.preset,
      start: 501,
      ...presetRules(c.preset),
      roundLimit: null,
      legsToWin: 99,
      setsToWin: null,
      entry: c.entry,
      punish: { ...c.punish, on: false },
      timedMinutes: 10,
    }),
    main: {
      label: 'Darts per leg',
      better: 'low',
      value: (m) => (m.legsWon ? m.wonDarts / m.legsWon : null),
      format: one,
      combine: 'mean',
    },
  },
  {
    id: 'eagleseye',
    name: "Eagle's Eye",
    group: 'bull',
    origin: 'DARTSLIVE',
    blurb: 'Eight rounds at the bull',
    rules: 'Only the bull scores: outer bull 25, inner bull 50. Highest total after 8 rounds wins. Max 1200.',
    multi: true,
    defaults: () => ({ kind: 'eagleseye', rounds: 8 }),
    main: score,
  },
  {
    id: 'bullseye',
    name: 'Bullseye drill',
    group: 'bull',
    blurb: '30 darts at the bull',
    rules: 'Throw 30 darts at the bull and track how many land. Inner bulls are counted too.',
    multi: true,
    defaults: (c) => ({ kind: 'scoring', target: 25, darts: 30, threshold: null, bull: bullFor(c.preset), entry: 'darts' }),
    main: { label: 'Bull %', better: 'high', value: (m) => ratio(m.hits, m.darts), format: pctFmt, combine: 'ratio' },
  },
  {
    id: 'cricketcountup',
    name: 'Cricket Count-Up',
    group: 'cricket',
    origin: 'DARTSLIVE',
    blurb: 'One round each at 20 to 15 and the bull',
    rules: "Only the round's number scores: 20, then 19, down to 15, then the bull. Trebles count triple. 250 is a good first target.",
    multi: true,
    defaults: () => ({ kind: 'cricketcountup' }),
    main: score,
  },
  {
    id: 'atc',
    name: 'Around the Clock',
    group: 'doubles',
    blurb: '1 to 20, then the bull',
    rules:
      'Hit each number in order, then the bull. Doubles mode (Doubles Around the World) needs the double each time. Fewest darts wins.',
    multi: true,
    defaults: () => ({ kind: 'atc', ring: 'single' }),
    main: { label: 'Darts', better: 'low', value: (m) => (m.complete ? m.score : null), format: int, combine: 'mean' },
  },
  {
    id: 'bobs27',
    name: "Bob's 27",
    group: 'doubles',
    blurb: 'The classic doubles test',
    rules:
      'Start on 27. Three darts at each double from 1 to 20, then the bull. Hits add the double, missing all three takes it away. Hit zero and you are out. Max 1437.',
    multi: true,
    defaults: () => ({ kind: 'bobs27', bull: true, continueBelowZero: false }),
    main: { label: 'Score', better: 'high', value: (m) => m.score, format: int, combine: 'mean' },
  },
  {
    id: 'frustration',
    name: 'Frustration',
    group: 'doubles',
    blurb: '80 with two darts, then the double',
    rules:
      'Score 80+ with your first two darts, then hit the double with the third to move on. D1 to D20, then the bull. A perfect run is 21 visits.',
    multi: true,
    defaults: () => ({ kind: 'frustration' }),
    main: { label: 'Visits', better: 'low', value: (m) => (m.complete ? m.score : null), format: int, combine: 'mean' },
  },
  {
    id: 'finish',
    name: 'Finish Trainer',
    group: 'finishing',
    origin: 'DARTSLIVE',
    blurb: 'Random finishes with a route hint',
    rules: 'You get a random score to finish within the dart limit. The suggested route is shown.',
    multi: false,
    defaults: (c) => ({
      kind: 'finish',
      min: c.preset === 'soft' ? 41 : 61,
      max: c.preset === 'soft' ? 170 : 120,
      darts: c.preset === 'soft' ? 3 : 6,
      outMode: presetRules(c.preset).outMode,
      bull: bullFor(c.preset),
      attempts: 10,
      entry: c.entry,
    }),
    main: { label: 'Success %', better: 'high', value: (m) => ratio(m.success, m.attempts), format: pctFmt, combine: 'ratio' },
  },
  {
    id: 'ladder121',
    name: '121 Checkout',
    group: 'finishing',
    blurb: 'Finish 121 in 9 darts, then go higher',
    rules:
      'Finish the target within 9 darts, double out. Success moves you up one. A finish in 3 darts or fewer becomes your safehouse: miss later and you drop back there.',
    multi: false,
    defaults: (c) => ({
      kind: 'ladder121',
      start: 121,
      darts: 9,
      step: 1,
      safehouse: 'three',
      rounds: 10,
      outMode: 'double',
      bull: bullFor(c.preset),
      entry: c.entry,
    }),
    main: { label: 'Highest', better: 'high', value: (m) => m.best ?? null, format: int, combine: 'mean' },
  },
  {
    id: 'catch40',
    name: 'Catch 40',
    group: 'finishing',
    blurb: 'Finish 61 to 100 in as few darts as possible',
    rules:
      'Six darts to finish each score from 61 to 100, double out. 2 darts = 3 points, 3 darts = 2, 4–6 darts = 1. 99 in 3 darts scores 3. Max 120, 40 is the benchmark.',
    multi: false,
    defaults: (c) => ({ kind: 'catch40', bull: bullFor(c.preset), entry: c.entry }),
    main: { label: 'Points', better: 'high', value: (m) => (m.complete ? m.points : null), format: int, combine: 'mean' },
  },
  {
    id: 'p170',
    name: '170 practice',
    group: 'finishing',
    blurb: 'T20, T20, Bull',
    rules: 'Ten attempts at the maximum finish with three darts each. Your treble 20 and bull hits are tracked.',
    multi: false,
    defaults: (c) => ({ kind: 'p170', attempts: 10, bull: bullFor(c.preset), entry: 'darts' }),
    main: { label: 'T20 %', better: 'high', value: (m) => ratio(m.t20, m.dartsThrown), format: pctFmt, combine: 'ratio' },
  },
  {
    id: 'checklist',
    name: 'Checkout list',
    group: 'finishing',
    blurb: 'The key doubles, 40 down to 4',
    rules: 'Three darts to finish each score on the list: 40, 36, 32, 28, 24, 20, 16, 12, 8, 4. Double out.',
    multi: false,
    defaults: (c) => ({
      kind: 'checklist',
      targets: [40, 36, 32, 28, 24, 20, 16, 12, 8, 4],
      darts: 3,
      outMode: 'double',
      bull: bullFor(c.preset),
      entry: c.entry,
    }),
    main: { label: 'Success %', better: 'high', value: (m) => ratio(m.success, m.attempts), format: pctFmt, combine: 'ratio' },
  },
  {
    id: 'halfit',
    name: 'Half-It',
    group: 'coverage',
    origin: 'DARTSLIVE',
    blurb: 'Miss the round and lose half',
    rules:
      'Start with 40. Each round has a target: 15, 16, any double, 17, 18, any treble, 19, 20, bull. Hits add points. Miss with all three and your score is cut in half.',
    multi: true,
    defaults: (c) => ({ kind: 'halfit', start: 40, targets: HALF_IT_DEFAULT, bull: bullFor(c.preset) }),
    main: score,
  },
  {
    id: 'shootout',
    name: 'Shoot Out',
    group: 'coverage',
    origin: 'DARTSLIVE',
    blurb: 'Every new number multiplies',
    rules:
      'Each number scores once: the number times how many areas you have opened, up to 21x. Save the big numbers for later. If you open all 21, the rest of your darts go at the bull.',
    multi: true,
    defaults: (c) => ({ kind: 'shootout', rounds: 8, bull: bullFor(c.preset) }),
    main: score,
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    group: 'coverage',
    blurb: 'Round number is the target',
    rules:
      'Round 1 aims at 1, round 2 at 2 and so on. Single, double and treble of the number in one visit is a Shanghai: an instant win with friends, +100 solo.',
    multi: true,
    defaults: () => ({ kind: 'shanghai', to: 7, bonus: 100 }),
    main: score,
  },
  {
    id: 'jdc',
    name: 'JDC Challenge',
    group: 'coverage',
    blurb: 'The junior grading workout',
    rules:
      'Part 1: Shanghai 10–15. Part 2: one dart at every double (50 each) and the bull (100). Part 3: Shanghai 15–20. Shanghais add 100.',
    multi: true,
    defaults: () => ({ kind: 'jdc' }),
    main: score,
  },
];

export const MATCH_ENTRIES = ['x01', 'cricket'] as const;

export function catalogEntry(id: string): CatalogEntry | undefined {
  return CATALOGUE.find((e) => e.id === id);
}

/** Default 01 match config. */
export function x01Defaults(ctx: DefaultsCtx, start = 501): GameConfig {
  return {
    kind: 'x01',
    preset: ctx.preset,
    start,
    ...presetRules(ctx.preset),
    roundLimit: defaultRoundLimit(ctx.preset, start),
    legsToWin: 1,
    setsToWin: null,
    entry: ctx.entry,
    punish: ctx.punish,
    timedMinutes: null,
  };
}

export function cricketDefaults(ctx: DefaultsCtx): GameConfig {
  return {
    kind: 'cricket',
    preset: ctx.preset,
    variant: 'standard',
    roundLimit: ctx.preset === 'soft' ? 20 : null,
    legsToWin: 1,
  };
}

/** Groups comparable games together in stats, e.g. 501 open-out vs 501 double-out. */
export function variantOf(c: GameConfig): string {
  switch (c.kind) {
    case 'x01':
      return c.timedMinutes ? `speed-${c.start}` : `${c.start}-${c.inMode}-${c.outMode}-${c.bull}`;
    case 'cricket':
      return c.variant;
    case 'countup':
      return `${c.rounds}-${c.bull}`;
    case 'scoring':
      return `${c.target}-${c.darts}-${c.threshold ?? ''}`;
    case 'atc':
      return c.ring;
    case 'ladder121':
      return `${c.start}-${c.darts}-${c.safehouse}-${c.outMode}`;
    case 'finish':
      return `${c.min}-${c.max}-${c.darts}-${c.outMode}`;
    case 'shanghai':
      return String(c.to);
    case 'bobs27':
      return c.bull ? 'bull' : 'nobull';
    default:
      return c.kind;
  }
}

/** Count-Up level names from the DARTSLIVE beginner guide. */
export function countUpTier(score: number): string {
  if (score >= 1000) return 'Master';
  if (score >= 800) return 'Advanced';
  if (score >= 600) return 'Intermediate';
  if (score >= 400) return 'Beginner';
  return 'Novice';
}
