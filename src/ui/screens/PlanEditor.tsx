import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { db, type PlanLimit, type PlanRow, type PlanStep } from '../../db/schema';
import { CATALOGUE, catalogEntry, GROUPS } from '../../engine/drills/catalogue';
import type { GameConfig } from '../../engine/types';
import { Field, Segmented, Sheet } from '../components/Controls';
import { TopBar } from '../components/TopBar';
import { usePrefs } from '../hooks';
import { limitText, startRun } from './Plans';
import { Options } from './Options';
import { defaultConfig } from './Setup';

export const stepName = (s: Pick<PlanStep, 'entry' | 'config' | 'bot'>) => {
  const base =
    s.entry === 'x01' && s.config.kind === 'x01'
      ? `${s.config.start}`
      : s.entry === 'cricket'
        ? 'Cricket'
        : (catalogEntry(s.entry)?.name ?? s.entry);
  if (!s.bot) return base;
  return `${base} vs ${s.bot === 'match' ? 'bot at your level' : `bot Rt ${s.bot}`}`;
};

function LimitEditor({ value, onChange }: { value: PlanLimit; onChange: (l: PlanLimit) => void }) {
  const kind = 'minutes' in value ? 'minutes' : 'count' in value ? 'count' : 'once';
  return (
    <>
      <Segmented
        label="Length"
        value={kind}
        options={[
          { value: 'once', label: 'Once' },
          { value: 'count', label: 'Games' },
          { value: 'minutes', label: 'Minutes' },
        ]}
        onChange={(k) => onChange(k === 'once' ? { once: true } : k === 'count' ? { count: 2 } : { minutes: 10 })}
      />
      {'count' in value && (
        <Segmented
          label="Games"
          value={value.count}
          options={[2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))}
          onChange={(count) => onChange({ count })}
        />
      )}
      {'minutes' in value && (
        <Segmented
          label="Minutes"
          value={value.minutes}
          options={[5, 10, 15, 20, 30].map((v) => ({ value: v, label: `${v}` }))}
          onChange={(minutes) => onChange({ minutes })}
        />
      )}
    </>
  );
}

function StepEditor({ step, onSave, onClose }: { step: PlanStep; onSave: (s: PlanStep) => void; onClose: () => void }) {
  const [s, setS] = useState(step);
  const isMatch = s.entry === 'x01' || s.entry === 'cricket';
  return (
    <Sheet onClose={onClose}>
      <h2>{stepName(s)}</h2>
      <Field label="Length" help="Minutes repeat the drill until the time is up.">
        <LimitEditor value={s.limit} onChange={(limit) => setS({ ...s, limit })} />
      </Field>
      {isMatch && (
        <Field label="Opponent">
          <select
            className="input"
            value={s.bot === undefined ? 'none' : String(s.bot)}
            onChange={(e) =>
              setS({ ...s, bot: e.target.value === 'none' ? undefined : e.target.value === 'match' ? 'match' : Number(e.target.value) })
            }
          >
            <option value="none">Solo</option>
            <option value="match">Bot at your level</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l}>
                Bot Rt {l}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Options entry={s.entry} config={s.config} onChange={(config: GameConfig) => setS({ ...s, config })} />
      <button className="btn primary block" onClick={() => onSave(s)}>
        Save step
      </button>
    </Sheet>
  );
}

export function PlanEditor({ id }: { id: string }) {
  const prefs = usePrefs();
  const [, navigate] = useLocation();
  const plan = useLiveQuery(async () => (await db.plans.get(id)) ?? null, [id]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  if (plan === undefined) return <main className="screen" />;
  if (plan === null) {
    return (
      <main className="screen">
        <TopBar title="Plan not found" back="/plans" />
      </main>
    );
  }
  const save = (patch: Partial<PlanRow>) => db.plans.update(plan.id, patch);
  const steps = plan.steps;
  const addStep = (entry: string) => {
    const config = defaultConfig(entry, prefs);
    if (!config) return;
    if (config.kind === 'ladder121') config.rounds = null;
    if (config.kind === 'finish') config.attempts = null;
    const limit: PlanLimit = config.kind === 'ladder121' || config.kind === 'finish' ? { minutes: 10 } : { once: true };
    save({ steps: [...steps, { entry, config, limit }] });
    setAdding(false);
  };

  return (
    <main className="screen">
      <TopBar title="Edit plan" back="/plans" />
      <Field label="Name">
        <input className="input" value={plan.name} onChange={(e) => save({ name: e.target.value })} />
      </Field>
      <section className="section">
        <h2>Steps</h2>
        {steps.length === 0 && <div className="empty">Add the drills and games for this routine, in the order you want to play them.</div>}
        {steps.length > 0 && (
          <div className="list">
            {steps.map((s, i) => (
              <div key={i} className="item">
                <span className="muted" style={{ width: 18 }}>
                  {i + 1}
                </span>
                <button
                  className="grow"
                  style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }}
                  onClick={() => setEditing(i)}
                >
                  <span className="title">{stepName(s)}</span>
                  <span className="desc" style={{ display: 'block' }}>
                    {limitText(s.limit)}
                  </span>
                </button>
                {i > 0 && (
                  <button
                    className="iconbtn"
                    aria-label="Move up"
                    onClick={() => save({ steps: steps.map((x, j) => (j === i - 1 ? steps[i] : j === i ? steps[i - 1] : x)) })}
                  >
                    ↑
                  </button>
                )}
                <button className="iconbtn" aria-label="Remove step" onClick={() => save({ steps: steps.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn" onClick={() => setAdding(true)}>
          Add a step
        </button>
      </section>
      <div className="row">
        <button
          className="btn ghost"
          style={{ color: '#ff8a80' }}
          onClick={async () => {
            if (!confirm('Delete this plan?')) return;
            await db.plans.delete(plan.id);
            navigate('/plans', { replace: true });
          }}
        >
          Delete plan
        </button>
        <button className="btn primary grow" disabled={steps.length === 0} onClick={async () => navigate(`/run/${await startRun(plan)}`)}>
          Start this plan
        </button>
      </div>

      {adding && (
        <Sheet onClose={() => setAdding(false)}>
          <h2>Add a step</h2>
          <div className="list">
            <button className="item" onClick={() => addStep('x01')}>
              <span className="title">01 game</span>
            </button>
            <button className="item" onClick={() => addStep('cricket')}>
              <span className="title">Cricket</span>
            </button>
          </div>
          {GROUPS.map((g) => (
            <div key={g.id} className="stack">
              <strong>{g.name}</strong>
              <div className="list">
                {CATALOGUE.filter((e) => e.group === g.id).map((e) => (
                  <button key={e.id} className="item" onClick={() => addStep(e.id)}>
                    <span className="title">{e.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Sheet>
      )}
      {editing !== null && steps[editing] && (
        <StepEditor
          step={steps[editing]}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            save({ steps: steps.map((x, j) => (j === editing ? s : x)) });
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}
