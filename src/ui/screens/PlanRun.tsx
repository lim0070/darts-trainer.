import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { createGame } from '../../db/repo';
import { db, type GameRow, type PlanRunRow } from '../../db/schema';
import type { Seat } from '../../engine/types';
import { TopBar } from '../components/TopBar';
import { formatClock, useNow, usePrefs } from '../hooks';
import { limitText } from './Plans';
import { stepName } from './PlanEditor';
import { buildSeats } from './Setup';

function stepDone(run: PlanRunRow, games: GameRow[], now: number): boolean {
  const step = run.plan.steps[run.stepIdx];
  if (!step) return true;
  const ids = run.results[run.stepIdx]?.gameIds ?? [];
  const finished = games.filter((g) => ids.includes(g.id) && g.status !== 'active');
  if ('once' in step.limit) return finished.length >= 1;
  if ('count' in step.limit) return finished.length >= step.limit.count;
  return run.stepStartedAt !== null && now >= run.stepStartedAt + step.limit.minutes * 60_000 && finished.length >= 1;
}

export function PlanRun({ id }: { id: string }) {
  const prefs = usePrefs();
  const [, navigate] = useLocation();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const run = useLiveQuery(async () => (await db.planRuns.get(id)) ?? null, [id]);
  const games = useLiveQuery(async () => (run ? await db.games.where('planRunId').equals(run.id).toArray() : []), [run?.id, run?.results]);
  if (run === undefined || games === undefined) return <main className="screen" />;
  if (run === null) {
    return (
      <main className="screen">
        <TopBar title="Plan run not found" back="/plans" />
      </main>
    );
  }
  const steps = run.plan.steps;
  const step = steps[run.stepIdx];
  const ids = run.results[run.stepIdx]?.gameIds ?? [];
  const live = games.find((g) => ids.includes(g.id) && g.status === 'active');
  const done = run.status === 'active' && stepDone(run, games, now);
  const end = step && 'minutes' in step.limit && run.stepStartedAt ? run.stepStartedAt + step.limit.minutes * 60_000 : null;

  const play = async () => {
    if (!step || busy || !prefs.meId) return;
    setBusy(true);
    const choices = [
      { kind: 'human' as const, id: prefs.meId },
      ...(step.bot !== undefined ? [{ kind: 'bot' as const, level: step.bot }] : []),
    ];
    const seats: Seat[] = await buildSeats(choices, step.config, prefs.meId);
    const gid = await createGame(step.entry, step.config, seats, { planRunId: run.id, planStep: run.stepIdx });
    const results = run.results.map((r, i) => (i === run.stepIdx ? { gameIds: [...r.gameIds, gid] } : r));
    await db.planRuns.update(run.id, { results, stepStartedAt: run.stepStartedAt ?? Date.now() });
    navigate(`/game/${gid}`);
  };

  const next = async () => {
    const last = run.stepIdx >= steps.length - 1;
    await db.planRuns.update(
      run.id,
      last ? { status: 'finished', finishedAt: Date.now() } : { stepIdx: run.stepIdx + 1, stepStartedAt: null },
    );
  };

  return (
    <main className="screen">
      <TopBar
        title={run.plan.name}
        sub={run.status === 'active' ? `Step ${run.stepIdx + 1} of ${steps.length}` : run.status === 'finished' ? 'Finished' : 'Stopped'}
        back="/plans"
      />
      <div className="list">
        {steps.map((s, i) => {
          const sg = games.filter((g) => run.results[i]?.gameIds.includes(g.id));
          const state =
            i < run.stepIdx || run.status === 'finished' ? 'done' : i === run.stepIdx && run.status === 'active' ? 'now' : 'later';
          return (
            <div key={i} className="item" style={state === 'now' ? { borderLeft: '4px solid var(--red)' } : undefined}>
              <span className="muted" style={{ width: 18 }}>
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="grow">
                <span className="title">{stepName(s)}</span>
                <span className="desc" style={{ display: 'block' }}>
                  {limitText(s.limit)}
                  {sg.length > 0 && `: ${sg.map((g) => g.resultLine ?? 'in progress').join(', ')}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {run.status === 'active' && step && (
        <div className="cta stack">
          {end && <p className="prose small">Time left on this step: {formatClock(end - now)}</p>}
          {live ? (
            <Link href={`/game/${live.id}`} className="btn primary block">
              Resume {stepName(step)}
            </Link>
          ) : done ? (
            <button className="btn primary block" onClick={next}>
              {run.stepIdx >= steps.length - 1 ? 'Finish the plan' : `Next: ${stepName(steps[run.stepIdx + 1])}`}
            </button>
          ) : (
            <button className="btn primary block" disabled={busy} onClick={play}>
              {ids.length === 0 ? `Start ${stepName(step)}` : `Play another ${stepName(step)}`}
            </button>
          )}
          <div className="row">
            {!done && !live && ids.length > 0 && (
              <button className="btn ghost small grow" onClick={next}>
                Skip to the next step
              </button>
            )}
            <button className="btn ghost small grow" onClick={() => db.planRuns.update(run.id, { status: 'abandoned' })}>
              Stop the plan
            </button>
          </div>
        </div>
      )}
      {run.status !== 'active' && (
        <Link href="/" className="btn block">
          Home
        </Link>
      )}
    </main>
  );
}
