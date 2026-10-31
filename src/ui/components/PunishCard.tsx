import { useEffect, useState } from 'react';
import type { DrawnCard } from '../../engine/types';
import { Led } from './Led';

function Task({ card }: { card: DrawnCard }) {
  if (card.reps === undefined) return <>{card.text}</>;
  const n = String(card.reps);
  const i = card.text.indexOf(n);
  if (i < 0) return <>{card.text}</>;
  return (
    <>
      {card.text.slice(0, i)}
      <span className="n">{n}</span>
      {card.text.slice(i + n.length)}
    </>
  );
}

/** The punishment: a referee's red card with the forfeit, Done or Skip. */
export function PunishCard({
  card,
  reason,
  who,
  onResolve,
}: {
  card: DrawnCard;
  reason: string;
  who: string;
  onResolve: (outcome: 'done' | 'skipped') => void;
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      // Not supported (iOS): the card itself is the signal.
    }
  }, []);

  useEffect(() => {
    if (left === null || left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const timed = card.unit === 'seconds' && card.reps !== undefined;

  return (
    <div className="overlay redcard-wrap">
      <div className="redcard" role="alertdialog" aria-labelledby="redcard-task" aria-describedby="redcard-reason">
        <div className="reason" id="redcard-reason">
          {reason}
        </div>
        <div className="who">{who}</div>
        <div className="task" id="redcard-task">
          <Task card={card} />
        </div>
        {timed && (
          <div className="timer">
            {left === null ? (
              <button
                className="btn block"
                style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff6ef' }}
                onClick={() => setLeft(card.reps!)}
              >
                Start the timer
              </button>
            ) : (
              <Led value={left} digits={2} on={left > 0} />
            )}
          </div>
        )}
        <div className="actions">
          <button onClick={() => onResolve('skipped')}>Skip</button>
          <button className="done" onClick={() => onResolve('done')}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
