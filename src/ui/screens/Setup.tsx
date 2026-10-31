import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ratingFromRows, statsFor } from '../../db/queries';
import { addPlayer, botPlayer, createGame } from '../../db/repo';
import { db, type PlayerRow } from '../../db/schema';
import { BOT_LEVELS, sigma01, sigmaCricket } from '../../engine/bot/level';
import { catalogEntry, cricketDefaults, x01Defaults } from '../../engine/drills/catalogue';
import { formatLevel } from '../../engine/rating';
import type { GameConfig, Seat } from '../../engine/types';
import { Sheet } from '../components/Controls';
import { TopBar } from '../components/TopBar';
import { usePrefs } from '../hooks';
import { Options } from './Options';

type SeatChoice = { kind: 'human'; id: string } | { kind: 'bot'; level: number | 'match' };

export function defaultConfig(entry: string, prefs: ReturnType<typeof usePrefs>): GameConfig | null {
  const ctx = { preset: prefs.preset, entry: prefs.entry, punish: prefs.punish };
  if (entry === 'x01') return x01Defaults(ctx, 501);
  if (entry === 'cricket') return cricketDefaults(ctx);
  return catalogEntry(entry)?.defaults(ctx) ?? null;
}

/** Turn seat choices into game seats; bots get their scatter fixed for this game. */
export async function buildSeats(choices: SeatChoice[], config: GameConfig, meId: string | null): Promise<Seat[]> {
  const est = meId ? ratingFromRows(await statsFor(meId)) : null;
  const seats: Seat[] = [];
  for (const ch of choices) {
    if (ch.kind === 'human') {
      const p = await db.players.get(ch.id);
      if (p) seats.push({ playerId: p.id, name: p.name });
      continue;
    }
    const row = await botPlayer(ch.level);
    const match = ch.level === 'match';
    const level = ch.level === 'match' ? ((config.kind === 'cricket' ? est?.levelCricket : est?.level01) ?? est?.overall ?? 6) : ch.level;
    const sigma = config.kind === 'cricket' ? sigmaCricket(level) : sigma01(level, config.kind === 'x01' ? config.preset : 'soft');
    seats.push({
      playerId: row.id,
      name: match ? `Bot (Rt ${formatLevel(level)})` : row.name,
      bot: { level, sigma, match },
    });
  }
  return seats;
}

function SeatList({
  seats,
  players,
  onChange,
  max,
  allowBots,
}: {
  seats: SeatChoice[];
  players: PlayerRow[];
  onChange: (s: SeatChoice[]) => void;
  max: number;
  allowBots: boolean;
}) {
  const [adding, setAdding] = useState<'human' | 'bot' | null>(null);
  const [newName, setNewName] = useState('');
  const humans = players.filter((p) => p.kind === 'human' && !p.archived);
  const seatedIds = new Set(seats.flatMap((s) => (s.kind === 'human' ? [s.id] : [])));
  const label = (s: SeatChoice) =>
    s.kind === 'human'
      ? (humans.find((h) => h.id === s.id)?.name ?? 'Player')
      : s.level === 'match'
        ? 'Bot (your level)'
        : `Bot Rt ${s.level}`;

  const replaceOrAdd = (s: SeatChoice) => {
    if (max === 1) onChange([s]);
    else onChange([...seats, s]);
    setAdding(null);
  };

  return (
    <div className="stack">
      <div className="list">
        {seats.map((s, i) => (
          <div className="item" key={i}>
            <span className="muted" style={{ width: 18 }}>
              {i + 1}
            </span>
            <span className="grow title">{label(s)}</span>
            {i > 0 && (
              <button
                className="iconbtn"
                aria-label={`Move ${label(s)} up`}
                onClick={() => onChange(seats.map((x, j) => (j === i - 1 ? seats[i] : j === i ? seats[i - 1] : x)))}
              >
                ↑
              </button>
            )}
            {seats.length > 1 && (
              <button className="iconbtn" aria-label={`Remove ${label(s)}`} onClick={() => onChange(seats.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="row">
        {(max === 1 || seats.length < max) && (
          <button className="btn small grow" onClick={() => setAdding('human')}>
            {max === 1 ? 'Change player' : 'Add player'}
          </button>
        )}
        {allowBots && seats.length < max && (
          <button className="btn small grow" onClick={() => setAdding('bot')}>
            Add bot
          </button>
        )}
      </div>
      {max > 1 && <p className="prose small">The first player throws first. Use the arrows to change the order.</p>}

      {adding === 'human' && (
        <Sheet onClose={() => setAdding(null)}>
          <h2>Choose a player</h2>
          <div className="list">
            {humans
              .filter((h) => !seatedIds.has(h.id) || max === 1)
              .map((h) => (
                <button key={h.id} className="item" onClick={() => replaceOrAdd({ kind: 'human', id: h.id })}>
                  <span className="dot" style={{ width: 10, height: 10, borderRadius: 5, background: h.color }} />
                  <span className="title">{h.name}</span>
                </button>
              ))}
          </div>
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              const p = await addPlayer(newName);
              setNewName('');
              replaceOrAdd({ kind: 'human', id: p.id });
            }}
          >
            <input className="input grow" placeholder="New player name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn small" type="submit">
              Add
            </button>
          </form>
        </Sheet>
      )}

      {adding === 'bot' && (
        <Sheet onClose={() => setAdding(null)}>
          <h2>Bot level</h2>
          <p className="prose small">Levels follow the DARTSLIVE rating scale. Rt 6 averages about 62, Rt 10 about 82, Rt 14 about 105.</p>
          <button className="btn primary block" onClick={() => replaceOrAdd({ kind: 'bot', level: 'match' })}>
            Match my level
          </button>
          <div className="choice-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {BOT_LEVELS.map((l) => (
              <button
                key={l}
                className="key"
                style={{ minHeight: 50, fontSize: '1.1rem' }}
                onClick={() => replaceOrAdd({ kind: 'bot', level: l })}
              >
                {l}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

export function Setup({ entry }: { entry: string }) {
  const prefs = usePrefs();
  const [, navigate] = useLocation();
  const players = useLiveQuery(() => db.players.toArray(), []);
  const cat = catalogEntry(entry);
  const isMatch = entry === 'x01' || entry === 'cricket';
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [seats, setSeats] = useState<SeatChoice[] | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!config && prefs.meId) setConfig(defaultConfig(entry, prefs));
    if (!seats && prefs.meId) setSeats([{ kind: 'human', id: prefs.meId }]);
  }, [prefs.meId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isMatch && !cat) {
    return (
      <main className="screen">
        <TopBar title="Not found" />
        <p className="prose">This game doesn't exist.</p>
      </main>
    );
  }
  const title = entry === 'x01' ? '01 game' : entry === 'cricket' ? 'Cricket' : cat!.name;
  const max = isMatch || cat?.multi ? 4 : 1;

  const start = async () => {
    if (!config || !seats || starting) return;
    setStarting(true);
    const built = await buildSeats(seats, config, prefs.meId);
    const id = await createGame(entry, config, built);
    navigate(`/game/${id}`, { replace: true });
  };

  return (
    <main className="screen">
      <TopBar title={title} back={isMatch ? '/' : '/train'} />
      {cat && (
        <p className="prose">
          {cat.rules}
          {cat.origin && <span className="tag">from {cat.origin}</span>}
        </p>
      )}
      {seats && players && (
        <section className="section">
          <h2>{max === 1 ? 'Player' : 'Players'}</h2>
          <SeatList seats={seats} players={players} onChange={setSeats} max={max} allowBots={isMatch} />
        </section>
      )}
      {config && (
        <section className="section">
          <h2>Rules</h2>
          <Options entry={entry} config={config} onChange={setConfig} />
        </section>
      )}
      <div className="cta">
        <button className="btn primary block" disabled={!config || !seats?.length || starting} onClick={start}>
          Start
        </button>
      </div>
    </main>
  );
}
