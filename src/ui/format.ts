import type { GameRow } from '../db/schema';
import { catalogEntry } from '../engine/drills/catalogue';
import { type AnyState, summarize } from '../engine/reduce';
import { ppr } from '../engine/stats';
import type { GameConfig } from '../engine/types';

/** "Sam wins", but "You win". */
export function wins(name: string, what = ''): string {
  return `${name} ${name === 'You' ? 'win' : 'wins'}${what ? ` ${what}` : ''}`;
}

export function gameTitle(game: Pick<GameRow, 'entry' | 'config'>): string {
  const c = game.config;
  if (game.entry === 'x01' && c.kind === 'x01') return String(c.start);
  if (game.entry === 'cricket' && c.kind === 'cricket') return c.variant === 'cutthroat' ? 'Cut-throat Cricket' : 'Cricket';
  return catalogEntry(game.entry)?.name ?? c.kind;
}

export function rulesLine(c: GameConfig): string {
  if (c.kind === 'x01') {
    const parts: string[] = [];
    if (c.inMode !== 'open') parts.push(`${c.inMode} in`);
    parts.push(c.outMode === 'open' ? 'open out' : `${c.outMode} out`);
    parts.push(c.bull === 'fat' ? 'fat bull' : 'separate bull');
    if (c.roundLimit) parts.push(`${c.roundLimit} rounds`);
    const line = parts.join(', ');
    return line.charAt(0).toUpperCase() + line.slice(1);
  }
  if (c.kind === 'cricket') return c.roundLimit ? `${c.roundLimit}-round limit` : 'No round limit';
  return '';
}

const names = (game: GameRow) => game.seats.map((s) => s.name);

/** One line for history lists, e.g. "Alex won 2–1" or "Score 642". */
export function resultLine(game: GameRow, s: AnyState): string {
  const rows = summarize(s);
  const who = names(game);
  if (s.kind === 'x01') {
    if (s.config.timedMinutes) {
      const m = rows[0].m;
      return m.legsWon ? `${m.legsWon} legs, ${Math.round(m.wonDarts / m.legsWon)} darts per leg` : 'No legs finished';
    }
    if (s.seats === 1) return `PPR ${ppr(rows[0].m.pts ?? 0, rows[0].m.darts ?? 0).toFixed(1)}`;
    if (s.winner === null) return 'Not finished';
    const score = s.config.setsToWin ? s.setsWon.join('–') : s.legsWonTotal.join('–');
    return `${who[s.winner]} won ${score}`;
  }
  if (s.kind === 'cricket') {
    if (s.seats === 1)
      return s.phase === 'over' ? `MPR ${((3 * (rows[0].m.marks ?? 0)) / Math.max(1, rows[0].m.darts ?? 0)).toFixed(2)}` : 'Not finished';
    return s.winner === null ? 'Not finished' : `${who[s.winner]} won ${s.legsWon.join('–')}`;
  }
  const entry = catalogEntry(game.entry);
  if (!entry) return '';
  const fmt = (seat: number) => {
    const v = entry.main.value(rows[seat].m);
    return v === null ? '–' : entry.main.format(v);
  };
  if (game.seats.length > 1) {
    if (s.winner !== null) return `${who[s.winner]} won, ${entry.main.label.toLowerCase()} ${fmt(s.winner)}`;
    return who.map((n, i) => `${n} ${fmt(i)}`).join(', ');
  }
  return `${entry.main.label} ${fmt(0)}`;
}

export function dateLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ` ${time}`;
}
