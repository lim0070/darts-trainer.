import type { GameRow } from '../../../db/schema';
import { catalogEntry, countUpTier } from '../../../engine/drills/catalogue';
import { type AnyState, summarize } from '../../../engine/reduce';
import { level01, levelCricket, formatLevel } from '../../../engine/rating';
import { pct, ppr } from '../../../engine/stats';

export interface Line {
  label: string;
  value: string;
}

/** The numbers worth showing for one player at the end of a game. */
export function seatSummary(game: GameRow, state: AnyState, seat: number): Line[] {
  const row = summarize(state)[seat];
  const m = row.m;
  if (state.kind === 'x01') {
    const lines: Line[] = [
      { label: 'PPR (3-dart average)', value: ppr(m.pts ?? 0, m.darts ?? 0).toFixed(1) },
      { label: 'First 9', value: ppr(m.f9pts ?? 0, m.f9darts ?? 0).toFixed(1) },
      { label: '80% PPR', value: m.p80rounds ? (m.p80pts / m.p80rounds).toFixed(1) : '–' },
    ];
    if (m.atf) lines.push({ label: 'Checkout', value: `${Math.round(pct(m.co ?? 0, m.atf))}% (${m.co ?? 0}/${m.atf})` });
    if (m.hico) lines.push({ label: 'Best finish', value: String(m.hico) });
    if (m.best) lines.push({ label: 'Best leg', value: `${m.best} darts` });
    const tons = [m.b180 && `${m.b180}×180`, m.b140 && `${m.b140}×140+`, m.b100 && `${m.b100}×100+`].filter(Boolean);
    if (tons.length) lines.push({ label: 'Big visits', value: tons.join(', ') });
    if (m.p80rounds && !state.config.timedMinutes)
      lines.push({ label: 'Rating level (this game)', value: formatLevel(level01(m.p80pts / m.p80rounds)) });
    return lines;
  }
  if (state.kind === 'cricket') {
    const mpr = m.darts ? (3 * m.marks) / m.darts : 0;
    return [
      { label: 'MPR (marks per round)', value: mpr.toFixed(2) },
      { label: '80% MPR', value: m.p80rounds ? (m.p80marks / m.p80rounds).toFixed(2) : '–' },
      { label: 'Marks', value: String(m.marks ?? 0) },
      { label: 'Rating level (this game)', value: m.p80rounds ? formatLevel(levelCricket(m.p80marks / m.p80rounds)) : '–' },
    ];
  }
  const entry = catalogEntry(game.entry);
  const lines: Line[] = [];
  if (entry) {
    const v = entry.main.value(m);
    lines.push({ label: entry.main.label, value: v === null ? '–' : entry.main.format(v) });
  }
  switch (game.entry) {
    case 'countup':
      lines.push({ label: 'Level', value: countUpTier(m.score ?? 0) });
      lines.push({ label: 'PPR', value: ((m.score ?? 0) / Math.max(1, m.rounds ?? 1)).toFixed(1) });
      break;
    case 'eagleseye':
      lines.push({ label: 'Bulls', value: `${m.hits ?? 0} of ${m.darts ?? 0}` });
      lines.push({ label: 'Inner bulls', value: String(m.inner ?? 0) });
      break;
    case 'cricketcountup':
      lines.push({ label: 'Marks', value: String(m.marks ?? 0) });
      lines.push({ label: 'MPR', value: ((m.marks ?? 0) / Math.max(1, m.rounds ?? 1)).toFixed(2) });
      break;
    case 't20':
    case 'hundred':
    case 'bullseye':
      lines.push({ label: 'Hits', value: `${m.hits ?? 0} of ${m.darts ?? 0}` });
      if (m.trebles !== undefined) lines.push({ label: 'Trebles', value: String(m.trebles) });
      if (m.inner !== undefined) lines.push({ label: 'Inner bulls', value: String(m.inner) });
      lines.push({ label: 'Points on target', value: String(m.score ?? 0) });
      break;
    case 'challenge':
      lines.push({ label: 'Total', value: String(m.score ?? 0) });
      lines.push({ label: 'PPR', value: ((3 * (m.score ?? 0)) / Math.max(1, m.darts ?? 1)).toFixed(1) });
      break;
    case 'bobs27':
      lines.push({ label: 'Rounds survived', value: String(m.rounds ?? 0) });
      lines.push({ label: 'Doubles hit', value: `${m.hits ?? 0} of ${m.darts ?? 0}` });
      break;
    case 'atc':
      lines.push({ label: 'Hit rate', value: `${Math.round(pct(m.hits ?? 0, m.darts ?? 0))}%` });
      break;
    case 'frustration':
      lines.push({ label: 'Doubles reached', value: String(m.reached ?? 0) });
      break;
    case 'ladder121':
      lines.push({ label: 'Longest streak', value: String(m.bestStreak ?? 0) });
      lines.push({ label: 'Finished', value: `${m.success ?? 0} of ${m.attempts ?? 0}` });
      break;
    case 'finish':
    case 'checklist':
    case 'catch40':
      lines.push({ label: 'Finished', value: `${m.success ?? 0} of ${m.attempts ?? 0}` });
      if (m.success) lines.push({ label: 'Darts per finish', value: (m.successDarts / m.success).toFixed(1) });
      break;
    case 'p170':
      lines.push({ label: '170s finished', value: `${m.success ?? 0} of ${m.attempts ?? 0}` });
      lines.push({ label: 'Bulls', value: String(m.bulls ?? 0) });
      break;
    case 'shanghai':
    case 'jdc':
      if (m.shanghais) lines.push({ label: 'Shanghais', value: String(m.shanghais) });
      break;
  }
  return lines;
}
