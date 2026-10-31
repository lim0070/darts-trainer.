import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { uid } from '../../db/repo';
import { db, type PunishPoolRow } from '../../db/schema';
import { Field, Segmented, Sheet, Switch } from '../components/Controls';
import { TopBar } from '../components/TopBar';

const blank = (): PunishPoolRow => ({
  id: uid(),
  text: '{n} push-ups',
  min: 5,
  max: 15,
  step: 1,
  unit: 'reps',
  tallyKey: null,
  weight: 1,
  enabled: true,
  builtin: false,
});

function rangeText(c: PunishPoolRow) {
  if (!c.text.includes('{n}')) return 'No number';
  return `${c.min}–${c.max}${c.unit === 'seconds' ? ' seconds' : ''}`;
}

function Editor({ card, onClose }: { card: PunishPoolRow; onClose: () => void }) {
  const [c, setC] = useState(card);
  const hasN = c.text.includes('{n}');
  const valid = c.text.trim().length > 0 && (!hasN || (c.min >= 0 && c.max >= c.min && c.step >= 1));
  return (
    <Sheet onClose={onClose}>
      <h2>{card.builtin ? 'Edit card' : 'Your card'}</h2>
      <Field label="What to do" help="Write {n} where the random number goes, e.g. {n} push-ups.">
        <input className="input" value={c.text} disabled={c.builtin} onChange={(e) => setC({ ...c, text: e.target.value })} />
      </Field>
      {hasN && (
        <>
          <div className="row">
            <Field label="From">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={c.min}
                onChange={(e) => setC({ ...c, min: Number(e.target.value) })}
              />
            </Field>
            <Field label="To">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={c.max}
                onChange={(e) => setC({ ...c, max: Number(e.target.value) })}
              />
            </Field>
            <Field label="Step">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={c.step}
                onChange={(e) => setC({ ...c, step: Number(e.target.value) })}
              />
            </Field>
          </div>
          {!c.builtin && (
            <Field label="Counts as">
              <Segmented
                label="Unit"
                value={c.unit ?? 'reps'}
                options={[
                  { value: 'reps', label: 'Reps' },
                  { value: 'seconds', label: 'Seconds (with a timer)' },
                ]}
                onChange={(unit) => setC({ ...c, unit })}
              />
            </Field>
          )}
        </>
      )}
      <Field label="How often" help="Higher comes up more.">
        <Segmented
          label="Weight"
          value={c.weight}
          options={[
            { value: 1, label: 'Normal' },
            { value: 2, label: 'Often' },
            { value: 3, label: 'Very often' },
          ]}
          onChange={(weight) => setC({ ...c, weight })}
        />
      </Field>
      <div className="row">
        {!card.builtin && (
          <button
            className="btn ghost"
            style={{ color: '#ff8a80' }}
            onClick={async () => {
              await db.punishPool.delete(card.id);
              onClose();
            }}
          >
            Delete
          </button>
        )}
        <button
          className="btn primary grow"
          disabled={!valid}
          onClick={async () => {
            const tallyKey = c.builtin ? c.tallyKey : hasN ? `custom:${c.text.replace('{n}', '').trim().toLowerCase()}` : null;
            await db.punishPool.put({ ...c, text: c.text.trim(), tallyKey, unit: hasN ? (c.unit ?? 'reps') : null });
            onClose();
          }}
        >
          Save card
        </button>
      </div>
    </Sheet>
  );
}

export function Cards() {
  const cards = useLiveQuery(() => db.punishPool.toArray(), []);
  const [editing, setEditing] = useState<PunishPoolRow | null>(null);
  const on = (cards ?? []).filter((c) => c.enabled).length;
  return (
    <main className="screen">
      <TopBar title="Punishment cards" sub={`${on} in the deck`} back="/settings" />
      <p className="prose small">Cards are drawn at random. Turn off the ones you don't want, or add your own.</p>
      <div className="list">
        {(cards ?? []).map((c) => (
          <div key={c.id} className="item">
            <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setEditing(c)}>
              <span className="title">{c.text.replace('{n}', 'N')}</span>
              <span className="desc" style={{ display: 'block' }}>
                {rangeText(c)}
                {c.weight > 1 ? `, comes up ${c.weight === 2 ? 'often' : 'very often'}` : ''}
                {!c.builtin ? ', yours' : ''}
              </span>
            </button>
            <div style={{ width: 64 }}>
              <Switch checked={c.enabled} onChange={(enabled) => db.punishPool.update(c.id, { enabled })}>
                <span className="sr-only">Use {c.text.replace('{n}', 'N')}</span>
              </Switch>
            </div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => setEditing(blank())}>
        Add your own card
      </button>
      {editing && <Editor card={editing} onClose={() => setEditing(null)} />}
    </main>
  );
}
