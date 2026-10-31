import { estimateRating, type RatedGame, type RatingEstimate } from '../engine/rating';
import { db, type PlayerStatsRow } from './schema';

export async function statsFor(playerId: string): Promise<PlayerStatsRow[]> {
  const rows = await db.playerStats.where('playerId').equals(playerId).toArray();
  return rows.sort((a, b) => a.finishedAt - b.finishedAt);
}

/** Per-game 80% stats that feed the rating estimate. */
export function ratingSeries(rows: PlayerStatsRow[]): { ppr: RatedGame[]; mpr: RatedGame[] } {
  const ppr: RatedGame[] = [];
  const mpr: RatedGame[] = [];
  for (const r of rows) {
    if (!r.complete) continue;
    if (r.kind === 'x01' && !r.variant.startsWith('speed') && (r.m.p80rounds ?? 0) > 0) {
      ppr.push({ value: r.m.p80pts / r.m.p80rounds, ts: r.finishedAt });
    }
    if (r.kind === 'cricket' && r.variant === 'standard' && (r.m.p80rounds ?? 0) > 0) {
      mpr.push({ value: r.m.p80marks / r.m.p80rounds, ts: r.finishedAt });
    }
  }
  return { ppr, mpr };
}

export function ratingFromRows(rows: PlayerStatsRow[]): RatingEstimate {
  const { ppr, mpr } = ratingSeries(rows);
  return estimateRating(ppr, mpr);
}

/** Rating after each rated game, for the trend chart. */
export function ratingHistory(rows: PlayerStatsRow[]): { ts: number; level: number }[] {
  const { ppr, mpr } = ratingSeries(rows);
  const all = [...ppr.map((g) => ({ ...g, t: 'p' })), ...mpr.map((g) => ({ ...g, t: 'm' }))].sort((a, b) => a.ts - b.ts);
  const out: { ts: number; level: number }[] = [];
  const p: RatedGame[] = [];
  const m: RatedGame[] = [];
  for (const g of all) {
    (g.t === 'p' ? p : m).push(g);
    const est = estimateRating(p, m);
    if (est.overall !== null) out.push({ ts: g.ts, level: est.overall });
  }
  return out;
}
