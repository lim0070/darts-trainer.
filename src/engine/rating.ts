// DARTSLIVE-style rating estimate (unofficial), from the public rating table:
// level = band of the 80% stats, with a fractional part inside the band.

export const PPR_FROM = [0, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 102, 109, 116, 123, 130];
export const MPR_FROM = [0, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.9, 3.1, 3.3, 3.5, 3.75, 4.0, 4.25, 4.5, 4.75];

export type Flight = 'C' | 'CC' | 'B' | 'BB' | 'A' | 'AA' | 'SA';

/** Fractional level 1–18 for a stat value, e.g. PPR 72.5 → 8.5. */
export function levelFor(value: number, from: readonly number[]): number {
  if (!(value > 0)) return 1;
  for (let i = from.length - 1; i >= 0; i--) {
    if (value >= from[i]) {
      if (i === from.length - 1) return from.length;
      const frac = (value - from[i]) / (from[i + 1] - from[i]);
      return i + 1 + frac;
    }
  }
  return 1;
}

export const level01 = (ppr: number) => levelFor(ppr, PPR_FROM);
export const levelCricket = (mpr: number) => levelFor(mpr, MPR_FROM);

export function flightOf(level: number): Flight {
  const l = Math.floor(level);
  if (l <= 3) return 'C';
  if (l <= 5) return 'CC';
  if (l <= 7) return 'B';
  if (l <= 9) return 'BB';
  if (l <= 12) return 'A';
  if (l <= 15) return 'AA';
  return 'SA';
}

/**
 * Middle of a level's band: what a bot of that level should average. The open-ended
 * bands use a realistic point instead (level 1 sits near the top of 0–40, a beginner).
 */
export function bandMid(level: number, from: readonly number[]): number {
  const i = Math.min(Math.max(Math.round(level), 1), from.length) - 1;
  if (i === 0) return from[1] - 1.5 * (from[2] - from[1]);
  if (i === from.length - 1) return from[i] + (from[i] - from[i - 1]);
  return (from[i] + from[i + 1]) / 2;
}

/** Display with one decimal, rounded down so 8.99 never shows as 9.0. */
export const formatLevel = (level: number) => (Math.floor(level * 10) / 10).toFixed(1);

export interface RatedGame {
  value: number;
  ts: number;
}

/** Recency-weighted mean of the last 30 games (newest weighs twice the oldest). */
export function rollingValue(games: readonly RatedGame[]): number | null {
  const last = [...games].sort((a, b) => a.ts - b.ts).slice(-30);
  if (last.length === 0) return null;
  let sum = 0;
  let weights = 0;
  last.forEach((g, i) => {
    const w = last.length === 1 ? 1 : 1 + i / (last.length - 1);
    sum += g.value * w;
    weights += w;
  });
  return sum / weights;
}

export interface RatingEstimate {
  level01: number | null;
  levelCricket: number | null;
  overall: number | null;
  flight: Flight | null;
  provisional: boolean;
  games01: number;
  gamesCricket: number;
}

export function estimateRating(ppr80: readonly RatedGame[], mpr80: readonly RatedGame[]): RatingEstimate {
  const p = rollingValue(ppr80);
  const m = rollingValue(mpr80);
  const l1 = p === null ? null : level01(p);
  const l2 = m === null ? null : levelCricket(m);
  const overall = l1 !== null && l2 !== null ? (l1 + l2) / 2 : (l1 ?? l2);
  return {
    level01: l1,
    levelCricket: l2,
    overall,
    flight: overall === null ? null : flightOf(overall),
    provisional: ppr80.length < 10 || mpr80.length < 10,
    games01: ppr80.length,
    gamesCricket: mpr80.length,
  };
}
