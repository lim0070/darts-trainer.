import { useState } from 'react';
import type { VisitAnalysis } from '../../engine/visitEntry';
import { Sheet } from './Controls';
import { BackspaceIcon } from './Icons';

export interface VisitInput {
  total: number;
  bust?: true;
  used?: number;
  atF?: number;
}

const QUICK = [26, 41, 45, 60, 81, 85, 100, 140, 180];

interface Ask {
  title: string;
  choices: number[];
  pick: (n: number) => void;
}

/**
 * Whole-visit score entry. Follow-up questions (darts used, darts at a finish)
 * only appear when the score allows more than one answer.
 */
export function Keypad({
  analyze,
  onSubmit,
  remaining,
  disabled,
  allowBust = true,
}: {
  analyze: (total: number, bust: boolean) => VisitAnalysis;
  onSubmit: (v: VisitInput) => void;
  remaining?: number;
  disabled?: boolean;
  allowBust?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);

  const press = (digit: string) => {
    setError(null);
    setTyped((t) => {
      const next = (t + digit).replace(/^0+(?=\d)/, '');
      return Number(next) > 180 || next.length > 3 ? t : next;
    });
  };

  const submit = (total: number, bust = false) => {
    if (disabled) return;
    const a = analyze(total, bust);
    if (!a.ok) {
      setError(a.reason);
      return;
    }
    setTyped('');
    setError(null);
    const finish = (used: number, atFinish: number[]) => {
      const send = (atF: number) => {
        setAsk(null);
        onSubmit({
          total: a.outcome === 'bust' ? 0 : a.total,
          ...(a.outcome === 'bust' ? { bust: true as const } : {}),
          used,
          atF,
        });
      };
      if (atFinish.length > 1) {
        setAsk({
          title: a.outcome === 'checkout' ? 'Darts at the finish, including the last one?' : 'Darts thrown at a finish?',
          choices: atFinish,
          pick: send,
        });
      } else {
        send(atFinish[0] ?? 0);
      }
    };
    if (a.options.length > 1) {
      setAsk({
        title: 'How many darts did the finish take?',
        choices: a.options.map((o) => o.used),
        pick: (used) => finish(used, a.options.find((o) => o.used === used)!.atFinish),
      });
    } else {
      finish(a.options[0].used, a.options[0].atFinish);
    }
  };

  const value = typed === '' ? null : Number(typed);
  const enterLabel = value === null ? 'No score' : remaining !== undefined && value === remaining ? `Check out ${value}` : `Enter ${value}`;

  return (
    <div className="pad">
      <div className="entry" aria-live="polite">
        {error ? <span className="error">{error}</span> : <span className="muted small">Visit score</span>}
        <span className={`value ${value === null ? 'placeholder' : ''}`}>{value ?? '0'}</span>
      </div>
      <div className="quick">
        {QUICK.map((q) => (
          <button key={q} type="button" disabled={disabled} onClick={() => submit(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} className="key" disabled={disabled} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button className="key soft" disabled={disabled} aria-label="Delete" onClick={() => setTyped((t) => t.slice(0, -1))}>
          <BackspaceIcon />
        </button>
        <button className="key" disabled={disabled} onClick={() => press('0')}>
          0
        </button>
        {allowBust ? (
          <button className="key warn" disabled={disabled} onClick={() => submit(0, true)}>
            Bust
          </button>
        ) : (
          <span />
        )}
      </div>
      <button className="btn primary block enter" disabled={disabled} onClick={() => submit(value ?? 0)}>
        {enterLabel}
      </button>
      {ask && (
        <Sheet onClose={() => setAsk(null)}>
          <h2>{ask.title}</h2>
          <div className="choice-row">
            {ask.choices.map((c) => (
              <button key={c} className="key" onClick={() => ask.pick(c)}>
                {c}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
