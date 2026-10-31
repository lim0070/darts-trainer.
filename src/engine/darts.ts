// Dart codes: S/D/T + number (1–20), S25 = outer bull, D25 = inner bull, M = miss.
type N = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
export type Dart = `S${N}` | `D${N}` | `T${N}` | 'S25' | 'D25' | 'M';
export type Mult = 0 | 1 | 2 | 3;

/** Clockwise from the top of the board. */
export const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

export const NUMBERS: readonly number[] = Array.from({ length: 20 }, (_, i) => i + 1);

export function makeDart(mult: 1 | 2 | 3, num: number): Dart {
  if (num === 25) {
    if (mult === 3) throw new Error('There is no treble bull');
    return mult === 2 ? 'D25' : 'S25';
  }
  if (!Number.isInteger(num) || num < 1 || num > 20) throw new Error(`Bad number ${num}`);
  return `${mult === 1 ? 'S' : mult === 2 ? 'D' : 'T'}${num}` as Dart;
}

export function dartNum(d: Dart): number {
  if (d === 'M') return 0;
  return Number(d.slice(1));
}

export function dartMult(d: Dart): Mult {
  if (d === 'M') return 0;
  const c = d[0];
  return c === 'S' ? 1 : c === 'D' ? 2 : 3;
}

export const isBull = (d: Dart): boolean => d === 'S25' || d === 'D25';

export function parseDart(s: string): Dart | null {
  if (s === 'M') return 'M';
  const m = /^([SDT])(\d{1,2})$/.exec(s);
  if (!m) return null;
  const n = Number(m[2]);
  if (n === 25) return m[1] === 'T' ? null : (s as Dart);
  if (n < 1 || n > 20) return null;
  return s as Dart;
}

/** All 62 darts that score (no miss). */
export const SCORING_DARTS: readonly Dart[] = [
  ...NUMBERS.map((n) => makeDart(1, n)),
  ...NUMBERS.map((n) => makeDart(2, n)),
  ...NUMBERS.map((n) => makeDart(3, n)),
  'S25',
  'D25',
];
