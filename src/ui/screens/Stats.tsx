import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ratingFromRows, ratingHistory, statsFor } from '../../db/queries';
import { db, type PlayerStatsRow } from '../../db/schema';
import { CATALOGUE, catalogEntry } from '../../engine/drills/catalogue';
import { TALLY_LABELS } from '../../engine/punish/builtins';
import { formatLevel } from '../../engine/rating';
import { pct, ppr } from '../../engine/stats';
import { Segmented } from '../components/Controls';
import { LineChart } from '../components/LineChart';
import { TopBar } from '../components/TopBar';
import { usePrefs } from '../hooks';

type Period = 7 | 30 | 365 | 0;

const sum = (rows: PlayerStatsRow[], k: string) => rows.reduce((t, r) => t + (r.m[k] ?? 0), 0);

function Tiles({ items }: { items: [string, string][] }) {
  return (
    <div className="tiles">
      {items.map(([k, v]) => (
        <div key={k} className="tile">
          <span className="v">{v}</span>
          <span className="k">{k}</span>
        </div>
      ))}
    </div>
  );
}

function X01Section({ rows }: { rows: PlayerStatsRow[] }) {
  const starts = [...new Set(rows.map((r) => r.variant.split('-')[0]))].sort((a, b) => Number(a) - Number(b));
  const [start, setStart] = useState<string>('all');
  const shown = start === 'all' ? rows : rows.filter((r) => r.variant.startsWith(`${start}-`));
  if (rows.length === 0) return null;
  const pts = sum(shown, 'pts');
  const darts = sum(shown, 'darts');
  const best = shown.map((r) => r.m.best).filter((v): v is number => !!v);
  const legs = sum(shown, 'legs');
  return (
    <section className="section">
      <h2>01 games</h2>
      {starts.length > 1 && (
        <Segmented
          label="Start score"
          value={start}
          options={[{ value: 'all', label: 'All' }, ...starts.map((s) => ({ value: s, label: s }))]}
          onChange={setStart}
        />
      )}
      <Tiles
        items={[
          ['PPR (3-dart average)', ppr(pts, darts).toFixed(1)],
          ['First 9', ppr(sum(shown, 'f9pts'), sum(shown, 'f9darts')).toFixed(1)],
          ['80% PPR', sum(shown, 'p80rounds') ? (sum(shown, 'p80pts') / sum(shown, 'p80rounds')).toFixed(1) : '–'],
          ['Checkout', sum(shown, 'atf') ? `${Math.round(pct(sum(shown, 'co'), sum(shown, 'atf')))}%` : '–'],
          ['Best finish', String(Math.max(0, ...shown.map((r) => r.m.hico ?? 0)) || '–')],
          ['Best leg', best.length ? `${Math.min(...best)} darts` : '–'],
          ['Darts per leg', sum(shown, 'legsWon') ? (sum(shown, 'wonDarts') / sum(shown, 'legsWon')).toFixed(1) : '–'],
          ['180s', String(sum(shown, 'b180'))],
          ['140+', String(sum(shown, 'b140'))],
          ['100+', String(sum(shown, 'b100'))],
          ['Legs won', `${sum(shown, 'legsWon')} of ${legs}`],
          ['Games', String(shown.length)],
        ]}
      />
      <LineChart
        title="PPR per game"
        points={shown.filter((r) => r.m.darts).map((r) => ({ ts: r.finishedAt, v: ppr(r.m.pts, r.m.darts) }))}
        format={(v) => v.toFixed(1)}
      />
    </section>
  );
}

function CricketSection({ rows }: { rows: PlayerStatsRow[] }) {
  if (rows.length === 0) return null;
  const vs = rows.filter((r) => r.solo === 0);
  return (
    <section className="section">
      <h2>Cricket</h2>
      <Tiles
        items={[
          ['MPR (marks per round)', ((3 * sum(rows, 'marks')) / Math.max(1, sum(rows, 'darts'))).toFixed(2)],
          ['80% MPR', sum(rows, 'p80rounds') ? (sum(rows, 'p80marks') / sum(rows, 'p80rounds')).toFixed(2) : '–'],
          ['Win rate', vs.length ? `${Math.round(pct(vs.filter((r) => r.won).length, vs.length))}%` : '–'],
          ['Games', String(rows.length)],
        ]}
      />
      <LineChart
        title="MPR per game"
        points={rows.filter((r) => r.m.darts).map((r) => ({ ts: r.finishedAt, v: (3 * r.m.marks) / r.m.darts }))}
        format={(v) => v.toFixed(2)}
      />
    </section>
  );
}

function TrainingSection({ rows }: { rows: PlayerStatsRow[] }) {
  const played = CATALOGUE.filter((e) => rows.some((r) => r.entry === e.id));
  const [sel, setSel] = useState<string | null>(null);
  if (played.length === 0) return null;
  const current = catalogEntry(sel ?? played[0].id)!;
  const mine = rows.filter((r) => r.entry === current.id);
  const values = mine
    .map((r) => ({ ts: r.finishedAt, v: current.main.value(r.m) }))
    .filter((p): p is { ts: number; v: number } => p.v !== null);
  const best = values.length
    ? current.main.better === 'high'
      ? Math.max(...values.map((p) => p.v))
      : Math.min(...values.map((p) => p.v))
    : null;
  const avg = values.length ? values.reduce((t, p) => t + p.v, 0) / values.length : null;
  return (
    <section className="section">
      <h2>Training</h2>
      <select className="input" value={current.id} onChange={(e) => setSel(e.target.value)} aria-label="Drill">
        {played.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({rows.filter((r) => r.entry === e.id).length})
          </option>
        ))}
      </select>
      <Tiles
        items={[
          [`Best ${current.main.label.toLowerCase()}`, best === null ? '–' : current.main.format(best)],
          [`Average ${current.main.label.toLowerCase()}`, avg === null ? '–' : current.main.format(avg)],
          ['Sessions', String(mine.length)],
        ]}
      />
      {values.length > 0 && (
        <LineChart
          title={`${current.name}: ${current.main.label}`}
          points={values}
          format={current.main.format}
          better={current.main.better}
        />
      )}
    </section>
  );
}

function PunishSection({ playerId, since }: { playerId: string; since: number }) {
  const log = useLiveQuery(
    async () => (await db.punishLog.where('playerId').equals(playerId).toArray()).filter((r) => r.ts >= since),
    [playerId, since],
  );
  if (!log || log.length === 0) return null;
  const done = log.filter((r) => r.outcome === 'done');
  const tallies = new Map<string, { n: number; unit?: string }>();
  for (const r of done) {
    if (!r.tallyKey || r.reps === undefined) continue;
    const t = tallies.get(r.tallyKey) ?? { n: 0, unit: r.unit };
    t.n += r.reps;
    tallies.set(r.tallyKey, t);
  }
  const triggers = new Map<string, number>();
  log.forEach((r) => triggers.set(r.trigger, (triggers.get(r.trigger) ?? 0) + 1));
  const top = [...triggers.entries()].sort((a, b) => b[1] - a[1])[0];
  const triggerName: Record<string, string> = {
    bust: 'busts',
    missedCheckout: 'missed finishes',
    lowScore: 'low scores',
    surprise: 'surprise cards',
  };
  const label = (k: string) => TALLY_LABELS[k] ?? k.replace(/^custom:/, '').replace(/^./, (c) => c.toUpperCase());
  return (
    <section className="section">
      <h2>Punishments</h2>
      <Tiles
        items={[
          ...[...tallies.entries()].map(([k, t]) => [label(k), String(t.n)] as [string, string]),
          ['Cards done', String(done.length)],
          ['Cards skipped', String(log.length - done.length)],
        ]}
      />
      {top && (
        <p className="prose small">
          Most cards came from {triggerName[top[0]] ?? top[0]} ({top[1]}). That's the part of your game to work on.
        </p>
      )}
    </section>
  );
}

export function Stats() {
  const prefs = usePrefs();
  const players = useLiveQuery(() => db.players.where('kind').equals('human').toArray(), []);
  const [pid, setPid] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(0);
  const playerId = pid ?? prefs.meId;
  const all = useLiveQuery(async () => (playerId ? statsFor(playerId) : []), [playerId]);
  const since = period ? Date.now() - period * 86_400_000 : 0;
  const rows = (all ?? []).filter((r) => r.finishedAt >= since);
  const rating = all ? ratingFromRows(all) : null;
  const history = all ? ratingHistory(all) : [];

  return (
    <main className="screen">
      <TopBar title="Stats" back="/" />
      {players && players.length > 1 && (
        <select className="input" value={playerId ?? ''} onChange={(e) => setPid(e.target.value)} aria-label="Player">
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <Segmented
        label="Period"
        value={period}
        options={[
          { value: 7, label: '7 days' },
          { value: 30, label: '30 days' },
          { value: 365, label: 'Year' },
          { value: 0, label: 'All time' },
        ]}
        onChange={setPeriod}
      />

      {rating?.overall != null && (
        <section className="section">
          <h2>Rating estimate</h2>
          <div className="panel row" style={{ alignItems: 'flex-end' }}>
            <div className="grow">
              <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, fontVariationSettings: "'wdth' 90" }}>
                {formatLevel(rating.overall)}
              </div>
              <div className="muted small">
                Flight {rating.flight}
                {rating.provisional ? ', provisional until 10 games of each type' : ''}
              </div>
            </div>
            <div className="stack small" style={{ textAlign: 'right' }}>
              <span>01: {rating.level01 === null ? '–' : formatLevel(rating.level01)}</span>
              <span>Cricket: {rating.levelCricket === null ? '–' : formatLevel(rating.levelCricket)}</span>
            </div>
          </div>
          <p className="prose small">
            Based on your last 30 rated games of 01 and Cricket (80% stats), using DARTSLIVE's public rating table. Unofficial.
          </p>
          {history.length > 1 && (
            <LineChart title="Rating" points={history.map((h) => ({ ts: h.ts, v: h.level }))} format={(v) => v.toFixed(1)} rolling={null} />
          )}
        </section>
      )}

      {all && rows.length === 0 && (
        <div className="empty">No finished games in this period yet. Play a game or a drill and your numbers show up here.</div>
      )}
      <X01Section rows={rows.filter((r) => r.kind === 'x01' && r.complete && !r.variant.startsWith('speed'))} />
      <CricketSection rows={rows.filter((r) => r.kind === 'cricket' && r.complete)} />
      <TrainingSection rows={rows.filter((r) => r.entry !== 'x01' && r.entry !== 'cricket')} />
      {playerId && <PunishSection playerId={playerId} since={since} />}
    </main>
  );
}
