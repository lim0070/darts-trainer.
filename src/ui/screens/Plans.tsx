import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation } from 'wouter';
import { uid } from '../../db/repo';
import { db, type PlanLimit, type PlanRow, type PlanRunRow } from '../../db/schema';
import { TopBar } from '../components/TopBar';

export function limitText(l: PlanLimit): string {
  if ('minutes' in l) return `${l.minutes} min`;
  if ('count' in l) return l.count === 1 ? '1 game' : `${l.count} games`;
  return 'Once';
}

export async function startRun(plan: PlanRow): Promise<string> {
  const run: PlanRunRow = {
    id: uid(),
    planId: plan.id,
    plan,
    status: 'active',
    stepIdx: 0,
    stepStartedAt: null,
    startedAt: Date.now(),
    results: plan.steps.map(() => ({ gameIds: [] })),
  };
  await db.transaction('rw', db.planRuns, async () => {
    const active = await db.planRuns.where('status').equals('active').toArray();
    for (const r of active) await db.planRuns.update(r.id, { status: 'abandoned' });
    await db.planRuns.add(run);
  });
  return run.id;
}

export function Plans() {
  const [, navigate] = useLocation();
  const plans = useLiveQuery(() => db.plans.toArray(), []);
  const runs = useLiveQuery(() => db.planRuns.orderBy('startedAt').reverse().limit(10).toArray(), []);
  return (
    <main className="screen">
      <TopBar title="Practice plans" back="/" />
      <p className="prose small">
        A plan is a routine of drills and games, run step by step. Each step's results are saved like any other game.
      </p>
      <div className="list">
        {(plans ?? []).map((p) => (
          <div key={p.id} className="item">
            <Link href={`/plans/${p.id}`} className="grow" style={{ color: 'inherit', textDecoration: 'none' }}>
              <span className="title">
                {p.name}
                {p.preset ? <span className="tag">Preset</span> : null}
              </span>
              <span className="desc" style={{ display: 'block' }}>
                {p.steps.length} steps: {p.steps.map((s) => limitText(s.limit)).join(', ')}
              </span>
            </Link>
            <button
              className="btn small primary"
              disabled={p.steps.length === 0}
              onClick={async () => navigate(`/run/${await startRun(p)}`)}
            >
              Start
            </button>
          </div>
        ))}
      </div>
      <button
        className="btn"
        onClick={async () => {
          const id = uid();
          await db.plans.add({ id, name: 'My routine', preset: 0, steps: [], createdAt: Date.now() });
          navigate(`/plans/${id}`);
        }}
      >
        New plan
      </button>
      {runs && runs.length > 0 && (
        <section className="section">
          <h2>Recent runs</h2>
          <div className="list">
            {runs.map((r) => (
              <Link key={r.id} href={`/run/${r.id}`} className="item">
                <span className="grow">
                  <span className="title">{r.plan.name}</span>
                  <span className="desc" style={{ display: 'block' }}>
                    {new Date(r.startedAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="side muted">
                  {r.status === 'active' ? `Step ${r.stepIdx + 1}` : r.status === 'finished' ? 'Finished' : 'Stopped'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
