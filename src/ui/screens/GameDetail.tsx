import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation } from 'wouter';
import { deleteGame } from '../../db/repo';
import { db } from '../../db/schema';
import { reduce } from '../../engine/reduce';
import { dartLabel } from '../../engine/rules';
import { TopBar } from '../components/TopBar';
import { dateLabel, gameTitle, rulesLine } from '../format';
import { seatSummary } from './play/summary';

export function GameDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const data = useLiveQuery(async () => {
    const game = await db.games.get(id);
    if (!game) return null;
    const log = await db.gameLogs.get(id);
    const punish = await db.punishLog.where('gameId').equals(id).toArray();
    return { game, state: reduce(game.config, game.seats.length, log?.events ?? []), punish };
  }, [id]);
  if (data === undefined) return <main className="screen" />;
  if (data === null) {
    return (
      <main className="screen">
        <TopBar title="Not found" back="/history" />
      </main>
    );
  }
  const { game, state, punish } = data;
  const bull = 'bull' in game.config && typeof game.config.bull === 'string' ? game.config.bull : 'separate';
  const visits = state.visits;
  const multiLeg = new Set(visits.map((v) => v.leg)).size > 1;
  return (
    <main className="screen">
      <TopBar title={gameTitle(game)} sub={dateLabel(game.createdAt)} back="/history" />
      <section className="panel stack">
        <strong style={{ fontSize: '1.2rem' }}>{game.resultLine ?? 'In progress'}</strong>
        {rulesLine(game.config) && <span className="muted small">{rulesLine(game.config)}</span>}
        {game.status === 'active' && (
          <Link href={`/game/${game.id}`} className="btn primary">
            Resume
          </Link>
        )}
      </section>
      {game.seats.map((s, i) => (
        <section key={i} className="section">
          <h2>{s.name}</h2>
          <table className="table">
            <tbody>
              {seatSummary(game, state, i).map((l) => (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td>{l.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {punish.length > 0 && (
        <section className="section">
          <h2>Punishments</h2>
          <div className="list">
            {punish.map((p) => (
              <div key={p.id} className="item">
                <span className="grow">{p.card.text}</span>
                <span className="side muted">{p.outcome === 'done' ? 'Done' : 'Skipped'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {visits.length > 0 && (
        <section className="section">
          <h2>Visits</h2>
          <table className="table">
            <thead>
              <tr>
                <th>{multiLeg ? 'Leg.round' : 'Round'}</th>
                {game.seats.length > 1 && <th style={{ textAlign: 'left' }}>Player</th>}
                <th>Darts</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v, i) => (
                <tr key={i}>
                  <td>{multiLeg ? `${v.leg + 1}.${v.round}` : v.round}</td>
                  {game.seats.length > 1 && <td style={{ textAlign: 'left' }}>{game.seats[v.seat]?.name}</td>}
                  <td className="muted">{v.darts ? v.darts.map((d) => dartLabel(d, bull)).join(' ') : `${v.used}`}</td>
                  <td>{v.bust ? 'Bust' : v.checkout && state.kind !== 'cricket' ? `${v.total} out` : v.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <button
        className="btn ghost"
        style={{ color: '#ff8a80' }}
        onClick={async () => {
          if (!confirm('Delete this game and its stats?')) return;
          await deleteGame(game.id);
          navigate('/history', { replace: true });
        }}
      >
        Delete game
      </button>
    </main>
  );
}
