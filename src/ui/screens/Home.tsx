import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'wouter';
import { ratingFromRows, statsFor } from '../../db/queries';
import { activeGame } from '../../db/repo';
import { db } from '../../db/schema';
import { formatLevel } from '../../engine/rating';
import { GearIcon } from '../components/Icons';
import { Led } from '../components/Led';
import { gameTitle } from '../format';
import { usePrefs } from '../hooks';

export function Home() {
  const prefs = usePrefs();
  const active = useLiveQuery(() => activeGame(), []);
  const rating = useLiveQuery(async () => (prefs.meId ? ratingFromRows(await statsFor(prefs.meId)) : null), [prefs.meId]);
  const run = useLiveQuery(async () => (await db.planRuns.where('status').equals('active').toArray())[0], []);

  return (
    <main className="screen">
      <header className="brand">
        <span className="name">Oche</span>
        {rating?.overall != null && (
          <Link href="/stats" className="rating-badge" aria-label="Your rating estimate">
            <b>{rating.flight}</b>
            <span>{formatLevel(rating.overall)}</span>
          </Link>
        )}
        <Link href="/settings" className="iconbtn" aria-label="Settings" style={{ marginLeft: rating?.overall != null ? 0 : 'auto' }}>
          <GearIcon />
        </Link>
      </header>

      {active && (
        <Link href={`/game/${active.id}`} className="resume">
          <span className="grow">
            <strong>Resume {gameTitle(active)}</strong>
            <span className="muted small" style={{ display: 'block' }}>
              {active.seats.map((s) => s.name).join(' vs ')}
            </span>
          </span>
          <span className="btn small primary">Resume</span>
        </Link>
      )}
      {run && !active && (
        <Link href={`/run/${run.id}`} className="resume">
          <span className="grow">
            <strong>Continue {run.plan.name}</strong>
            <span className="muted small" style={{ display: 'block' }}>
              Step {run.stepIdx + 1} of {run.plan.steps.length}
            </span>
          </span>
          <span className="btn small primary">Continue</span>
        </Link>
      )}

      <section className="section" aria-label="Play">
        <div className="play-tiles">
          <Link href="/new/x01" className="play-tile">
            <Led value={501} />
            <span className="label">
              01 game
              <small>301 to 1501, solo, friends or bot</small>
            </span>
          </Link>
          <Link href="/new/cricket" className="play-tile">
            <span className="marks" aria-hidden="true">
              20 19 18
            </span>
            <span className="label">
              Cricket
              <small>Standard or cut-throat</small>
            </span>
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>Train</h2>
        <div className="list">
          <Link href="/train" className="item">
            <span className="grow">
              <span className="title">Training drills</span>
              <span className="desc" style={{ display: 'block' }}>
                Count-Up, Bob's 27, 121, Catch 40 and 16 more
              </span>
            </span>
          </Link>
          <Link href="/plans" className="item">
            <span className="grow">
              <span className="title">Practice plans</span>
              <span className="desc" style={{ display: 'block' }}>
                Run a routine step by step
              </span>
            </span>
          </Link>
          <Link href="/punishments" className="item">
            <span className="grow">
              <span className="title">Punishments</span>
              <span className="desc" style={{ display: 'block' }}>
                Your cards and when they come up
              </span>
            </span>
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>Record</h2>
        <nav className="nav-grid">
          <Link href="/history">History</Link>
          <Link href="/stats">Stats</Link>
          <Link href="/players">Players</Link>
        </nav>
      </section>
    </main>
  );
}
