import type { VisitRecord } from './types';
import type { X01State } from './x01';

/** Per-seat summary stored with each finished game. Counters add up across games. */
export interface StatRow {
  seat: number;
  won: boolean;
  m: Record<string, number>;
  /** Checkout scores hit (01 only). */
  co?: number[];
}

const inc = (m: Record<string, number>, k: string, by = 1) => {
  m[k] = (m[k] ?? 0) + by;
};

export function summarizeX01(s: X01State): StatRow[] {
  const rows: StatRow[] = [];
  const start = s.config.start;
  for (let seat = 0; seat < s.seats; seat++) {
    const m: Record<string, number> = {};
    const co: number[] = [];
    for (const leg of s.legs) {
      if (!leg.complete) continue;
      const vs = s.visits.filter((v) => v.leg === leg.index && v.seat === seat);
      if (vs.length === 0) continue;
      inc(m, 'legs');
      let legDarts = 0;
      let cum = 0;
      let reached80 = false;
      vs.forEach((v, i) => {
        inc(m, 'visits');
        inc(m, 'darts', v.used);
        inc(m, 'pts', v.total);
        inc(m, 'atf', v.atF);
        legDarts += v.used;
        if (i < 3) {
          inc(m, 'f9pts', v.total);
          inc(m, 'f9darts', v.used);
        }
        if (!reached80) {
          cum += v.total;
          inc(m, 'p80rounds');
          if (cum >= 0.8 * start) {
            reached80 = true;
          }
        }
        if (v.bust) inc(m, 'busts');
        else bandVisit(m, v);
        if (v.checkout) {
          inc(m, 'co');
          co.push(v.start);
          m.hico = Math.max(m.hico ?? 0, v.start);
        }
      });
      inc(m, 'p80pts', cum);
      if (leg.winner === seat) {
        inc(m, 'legsWon');
        inc(m, 'wonDarts', legDarts);
        m.best = m.best ? Math.min(m.best, legDarts) : legDarts;
        if (leg.startTs !== null && leg.endTs !== null) {
          const secs = Math.round((leg.endTs - leg.startTs) / 1000);
          m.bestSecs = m.bestSecs ? Math.min(m.bestSecs, secs) : secs;
          inc(m, 'wonSecs', secs);
        }
      }
    }
    rows.push({ seat, won: s.winner === seat, m, co });
  }
  return rows;
}

function bandVisit(m: Record<string, number>, v: VisitRecord) {
  const t = v.total;
  if (t === 180) inc(m, 'b180');
  else if (t >= 140) inc(m, 'b140');
  else if (t >= 100) inc(m, 'b100');
  else if (t >= 60) inc(m, 'b60');
}

/** Three-dart average (points per round). */
export const ppr = (pts: number, darts: number): number => (darts > 0 ? (3 * pts) / darts : 0);

export const pct = (part: number, whole: number): number => (whole > 0 ? (100 * part) / whole : 0);
